#!/bin/bash

#return code
#0 - all good
#1 - failed to download node

echo "running boot.sh on " `hostname` "as user" `whoami` `uname -a` `cat /etc/issue`
env

echo "setting up squid location"
export OSG_SQUID_LOCATION=${OSG_SQUID_LOCATION:-UNAVAILABLE}
if [ "$OSG_SQUID_LOCATION" != UNAVAILABLE ]; then
    echo "using squid:" $OSG_SQUID_LOCATION
    export http_proxy=$OSG_SQUID_LOCATION
else
    echo "OSG_SQUID_LOCATION is not set... not using squid"
fi

echo "downloading node"
node_download_url=http://nodejs.org/dist/v0.10.24/node-v0.10.24-linux-x64.tar.gz
curl -m 120 -H "Pragma:" -O $node_download_url
if [ $? -ne 0 ]; then
    echo "failed to download node.. quitting"
    exit 1 
#    echo "couldn't download node.. trying without http_proxy again"
#    unset http_proxy
#    curl -m 120 -H "Pragma:" -O $node_download_url
#    if [ $? -ne 0 ]; then
#        echo "failed again.. exiting"
#        exit 1
#    fi
fi

echo "unpack node"
tar -xzf node-v0.10.24-linux-x64.tar.gz
export PATH=./node-v0.10.24-linux-x64/bin:$PATH

echo "node version" `which node` `node -v`
echo "npm version" `which npm` `npm -v`

echo "npm installing node-osg"
npm install osg
#npm link ~/git/node-osg

echo "listing" `pwd`
ls -la node_modules/osg

echo "starting run.js"
node node_modules/osg/wn/run.js "$@"


