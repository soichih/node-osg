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
    #export http_proxy=$OSG_SQUID_LOCATION
else
    echo "OSG_SQUID_LOCATION is not set... not using squid"
fi

export tmp=${OSG_WN_TMP:-/tmp}

node_name=node-v0.10.24-linux-x64
if [ ! -d $tmp/$node_name ];
then
    node_download_url=http://nodejs.org/dist/v0.10.24/$node_name.tar.gz
    echo "downloading $node_download_url"
    ( cd $tmp; curl -m 120 -H "Pragma:" -O $node_download_url )
    if [ $? -ne 0 ]; then
        echo "failed to download node.. quitting"
        exit 1 
    fi

    echo "unpacking node"
    ( cd $tmp ; tar -xzf $node_name.tar.gz )
else
    echo "$tmp/$node_name already downloaded & unpacked"
fi

#TODO - verify node installation...

export PATH=$tmp/$node_name/bin:$PATH

echo "node version" `which node` `node -v`
echo "npm version" `which npm` `npm -v`

echo "npm installing node-osg"
#npm link ~/git/node-osg
#time npm install -registry http://registry.npmjs.org/ -g osg
time npm install -g osg
if [[ $? != 0 ]] ;
then
    echo "failed to npm install node-osg.. dumping debug log"
    ls -la node_modules/osg
    cat npm-debug.log
    exit 1
fi

echo "dumping wn directory content one last time" `pwd`
ls -la

#this works, but we need to parse options.json to set it here.. 
#it would be much better if I could do this in run.js
#ulimit -v 300000

echo "starting run.js" #use run.js that comes with node-osg
node $tmp/$node_name/lib/node_modules/osg/wn/run.js "$@"
ret=$?

#echo "exited run.js with code $ret"
exit $ret
