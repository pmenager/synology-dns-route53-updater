#!/usr/bin/env node

/* This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND. See the accompanying
 * LICENSE file.
 */

/**
 *
 * Author : paul menager
 * Requirements : intended to be run on synology disks (NAS)
 * Installation : npm install public-ip aws-sdk
 * Run : node updateRoute53.js
 * Date : 20150814
 */

/**
 * Configuration
 */
var AWS_ACCESS_KEY = "EDIT_ME";
var AWS_SECRET_KEY = "EDIT_ME";
var AWS_REGION = "us-west-1";//EDIT_ME
var previousIpFileLocation = "ip.txt";
var fileEncoding = "utf8";
var ROUTE53_HOSTED_ZONE_ID = "/hostedzone/EDIT_ME";
var ROUTE53_DOMAIN = "EDIT_ME";
/**
 * Global variables
 */
var currentIP = null;
var previousIP = null;

/**
 * Dependencies
 */
/*
 Package for getting public IP
 */
var publicIp = require('public-ip');
/*
 Package for file system
 */
var fs = require('fs');
/*
 var AWS = require('aws-sdk');
 */
var AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY
});
AWS.config.update({region: AWS_REGION});
/*
 Package used for calling synology DSM CLI tool
 */
var exec = require('child_process').exec;

var publicIpCallback = function (err, ip) {
    if (err) {
        console.log("Unable to get public IP");
        return console.log(err);
    } else {
        currentIP = ip;
        console.log("Current public IP is " + currentIP);
        if (previousIP) {
            compareIP();
        }
    }
};

var getPublicIP = function () {
    publicIp(publicIpCallback);
};

var getPreviousIP = function () {
    fs.stat(previousIpFileLocation, function (err, stat) {
        if (err && err.code == 'ENOENT') {
            fs.writeFile(previousIpFileLocation, '');
        } else if (err) {
            console.log('Error creating previous IP file : ', err.code);
            notifySynologyDSM("Error creating previous IP file : " + err.code);
        }
    });

    fs.readFile(previousIpFileLocation, fileEncoding, function (err, data) {
        if (err) {
            console.log("Error reading file : " + err.code);
            notifySynologyDSM("Error reading previous IP file : " + err.code);
        } else if (!data || data === '') {
            writeCurrentIPInFile();
        } else {
            previousIP = data;
            console.log("Previous public IP was " + previousIP);
            if (currentIP) {
                compareIP();
            }
        }
    });
};

var writeCurrentIPInFile = function () {
    if (currentIP) {
        fs.writeFile(previousIpFileLocation, currentIP, function (err) {
            if (err) {
                console.log("Error writing previous IP file : " + err.code);
                notifySynologyDSM("Error writing previous IP file : " + err.code);
            }
            console.log("The previous IP file was updated with the new IP : " + currentIP);
        });
    }
};

var compareIP = function () {
    if (hasIPChanged()) {
        updateRoute53WithNewIP();
    } else {
        console.log("Nothing to do ...");
    }
};

var hasIPChanged = function () {
    if (currentIP && previousIP) {
        return currentIP !== previousIP
    }
};

var updateRoute53WithNewIP = function () {
    var route53 = new AWS.Route53();
    var params = {
        "HostedZoneId": ROUTE53_HOSTED_ZONE_ID,
        "ChangeBatch": {
            "Changes": [
                {
                    "Action": 'UPSERT',
                    "ResourceRecordSet": {
                        "Name": ROUTE53_DOMAIN,
                        "Type": 'A',
                        "TTL": 300,
                        "ResourceRecords": [
                            {
                                "Value": currentIP
                            }
                        ]
                    }
                }
            ]
        }
    };
    route53.changeResourceRecordSets(params, function (err, data) {
        if (err) {
            console.log("Unable to update Route 53 !");
            notifySynologyDSM("Error updating route 53 : " + err.code + " / " + err.statusCode);
            console.log(err, err.stack);
        }
        else {
            console.log("Successfully updated Route 53");
            notifySynologyDSM("New IP(" + currentIP + ") has successfully been submitted to route 53.");
            writeCurrentIPInFile();
        }
    });

};

var notifySynologyDSM = function (body) {
    var title = "Script DNS route 53 updater.";
    exec("synodsmnotify @administrators '" + title + "' '" + body + "'", function (error, stdout, stderr) {
        // command output is in stdout
    });
};

var startPoint = function () {
    getPublicIP();
    getPreviousIP();
};

startPoint();
