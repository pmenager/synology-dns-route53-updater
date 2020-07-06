synology-dns-route53-updater
=====================

Main features and goal
------------

Designed for Synology NAS.
Update a DNS record within AWS Route 53 with the current external IP.
The route 53 post will be made only if the IP has changed (previous known IP is stored via a txt file).
Useful for internet connection without static IP address. Makes your domain point to your IP.
Will pop up a notification in DSM for all user which are members of 'administrators'.

Requirements
------------
* A Synology NAS with DSM
* Node installed (via DSM packet store)
* Node required packages locally installed
* An AWS account with a user with an access and secret key with the IAM role route53:ChangeResourceRecordSets on the required domain name
* The Zone ID of the route 53 managed domain
* The domain / subdomain itself

Installation
------------
1. Install node via DSM store
2. Download / copy-paste script synoDNSUpdater.js and package.json to a local folder on the NAS filesystem
3. Install node dependencies along with the script :
```
  npm install
```
4. Edit the configuration of the script with required settings

Run
------------
```
  node synoDNSUpdater.js
```

Launch the script via task scheduler
------------
1. In Synology DSM, go to "Control pannel" and then go to "Task planner"
2. Create a new task via "Create" > "User defined script"
3. Name your task, choose the executing user (must have access to the script itself)
4. Enter the script, something like that :
```
  cd /path/to/folder/containing/script
  node /path/to/folder/containing/script/synoDNSUpdater.js
```
5. Set the schedule as you want
