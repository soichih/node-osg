echo "boot.sh on " `hostname` "as user" `whoami` `uname -a` `cat /etc/issue`
echo "boot.sh cmd: $@"
env | sort

#enable osg client tool
chmod +x osg
export PATH=$PATH:./

osg set-httpproxy

node_name=node-v0.10.24-linux-x64
osg app http://nodejs.org/dist/v0.10.24/$node_name.tar.gz $node_name
if [[ $? != 0 ]] ;
then
    echo "failed to download $node_name"
    exit 1
fi

#TODO - verify node installation...

export PATH=$node_name/bin:$PATH

echo "node version" `which node` `node -v`
echo "npm version" `which npm` `npm -v`

echo "installing node-osg"
#npm link ~/git/node-osg

unset http_proxy
npm install -g osg
if [[ $? != 0 ]] ;
then
    echo "failed to npm install node-osg.. dumping debug log"
    ls -la node_modules/osg
    cat npm-debug.log
    exit 2
fi

#echo "dumping wn directory content one last time" `pwd`
#ls -la

#this works, but we need to parse options.json to set it here.. 
#it would be much better if I could do this in run.js
#ulimit -v 300000

echo "starting run.js" #use run.js that comes with node-osg
node $node_name/lib/node_modules/osg/wn/run.js "$@"
ret=$?

exit $?

