#!/usr/bin/env node

/* This code is PUBLIC DOMAIN, and is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND. See the accompanying
 * LICENSE file.
 */

/**
 *
 * Author : paul menager (w/ update from shawn mcnaughton)
 * Requirements : intended to be run on synology disks (NAS)
 * Installation : npm install
 * Run : node synoDNSUpdater.js
 * Date : 20170618
 */

/**************************************
 * Start Configuration
 **************************************/
// AWS_ACCESS_KEY
// AWS Access Key for a user with route53:ChangeResourceRecordSets and route53:ListResourceRecordSets on the domain you want to modify
// Example: ABCABCABCABCABCABC1A
var AWS_ACCESS_KEY = "EDIT_ME";

// AWS_SECRET_KEY
// AWS Secret Key for a user with route53:ChangeResourceRecordSets and route53:ListResourceRecordSets on the domain you want to modify
// Example: ABCD+v+Abc123Abc123Abc123Abc123Abc123Abc
var AWS_SECRET_KEY = "EDIT_ME";

// AWS_REGION
// AWS Region to act in - won't matter for most records, except R53 'latency optimized'
// Example: us-west-1
var AWS_REGION = "EDIT_ME";

// ROUTE53_HOSTED_ZONE_ID
// The Hosted Zone ID in Route 53 for the domain
// Example: /hostedzone/ABC123ABC123AB
var ROUTE53_HOSTED_ZONE_ID = "/hostedzone/EDIT_ME";

// ROUTE53_DOMAIN
// The actual name of the domain name to modify, including an ending period
// Examples: mysite.com. OR me.myshareddomain.com.
var ROUTE53_DOMAIN = "EDIT_ME";

/**************************************
 * End Configuration
 **************************************/

/**
 * Global variables
 */
var currentIP = null;
var previousIP = null;

/**
 * Dependencies
 */
var Promise = require('bluebird');
var publicIp = require('public-ip');
var AWS = require('aws-sdk');
var exec = require('child_process').exec;

AWS.config.update({
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY
});
AWS.config.update({region: AWS_REGION});
if (typeof Promise === 'undefined') {
  AWS.config.setPromisesDependency(require('bluebird'));
}
var route53 = new AWS.Route53();

var getPublicIP = function () {
    return publicIp.v4()
	    .then(function(ip) {
	        currentIP = ip;
	        console.log("Current public IP is " + currentIP);
    	}).catch(function(err) {
	        console.log("Unable to get public IP");
	        console.log(err);
	        throw err;
    	});
};

var getLatestRegisteredIPFromRoute53 = function() {
    var params = {
        "HostedZoneId": ROUTE53_HOSTED_ZONE_ID,
        "StartRecordName": ROUTE53_DOMAIN,
        "StartRecordType": 'A',
        "MaxItems": '1'
    };
    return route53.listResourceRecordSets(params).promise()
    	.then(function(listResults) {
    		previousIP = listResults.ResourceRecordSets[0].ResourceRecords[0].Value;
            console.log("Successfully polled Route 53 and retrieved Registered IP of " + currentIP);
            notifySynologyDSM("Successfully polled Route 53 and retrieved Registered IP of (" + currentIP + ")");
            return previousIP;
    	})
    	.catch(function(err) {
            console.log("Unable to poll from Route 53!");
            notifySynologyDSM("Error polling route 53 : " + err.code + " / " + err.statusCode);
            console.log(err, err.stack);
            throw err;
    	});
};

var updateRoute53WithNewIP = function() {
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
    return route53.changeResourceRecordSets(params).promise()
    	.then(function() {
            console.log("Successfully updated Route 53");
            notifySynologyDSM("New IP(" + currentIP + ") has successfully been submitted to route 53.");
            return true;
    	})
    	.catch(function(err) {
            console.log("Unable to update Route 53 !");
            notifySynologyDSM("Error updating route 53 : " + err.code + " / " + err.statusCode);
            console.log(err, err.stack);
            throw err;
    	});
};

var notifySynologyDSM = function (body) {
    var title = "Script DNS route 53 updater.";
    exec("synodsmnotify @administrators '" + title + "' '" + body + "'", function (error, stdout, stderr) {
        // command output is in stdout
    });
};

var startPoint = function () {
    Promise.all([getPublicIP(), getLatestRegisteredIPFromRoute53()])
    	.then(function() {
		    if (currentIP !== previousIP) {
		        console.log("Current IP " + currentIP + " differs from Registered IP " + previousIP + "; updating...");
		        return updateRoute53WithNewIP();
		    } else {
		        console.log("Current and Registered IP are both " + currentIP + "; exiting...");
		        return true;
		    }
		});
};

startPoint();
