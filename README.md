node-osg
========

Open Science Grid client in nodejs. It's mainly a wrapper around htcondor and makes it easier to submit / monitor jobs in OSG environment by providing functionalities often used by jobs submitted to Open Science Grid.

As this is a node client, node executable will be automatically shipped to the remote cluster, but you can run non-javascript code at the worker node. You can use node-osg as a submission / dynamic workflow management tool. 

## Install

```
npm install node-osg
```

## Submit job and monitor events

```
var osg = require('osg');
var fs = require('fs');
var path = require('path');

var workflow = new osg.Workflow();

var job = workflow.submit({
    executable: 'job.sh', //executable to send & run (usually a shell script)

    //timeout currently uses periodic_hold submit option. depending on your condor config, "periodic" could mean
    //every seconds to every 300 seconds (check by running "condor_config_val PERIODIC_EXPR_INTERVAL")
    //if you set this to any value below PERIODIC_EXPR_INTERVAL, your timeout might not get triggered
    timeout: 60*1000*10, //hold job after 10 minutes

    //set callback function to stage any input files (or symlink to the actual file)
    //that you wish to send to the remote hosts
    rundir: function(rundir, next) {
        console.log("using rundir:"+rundir);
        fs.symlink(path.resolve('job.js'), rundir+"/job.js", next);
    }
});
job.on('submit', function(info) {
    console.log("submitted");
    console.dir(info);
});
job.on('submitfail', function(info) {
    console.log("submission failed");
    console.dir(info);
});
job.on('execute', function(info) {
    console.log("job executing");
    console.dir(info);
    job.q(function(err, data) {
        console.dir(data);
        console.log("running on "+data.MATCH_EXP_JOB_Site);
    });
});
job.on('progress', function(info) {
    console.log("progressing / image_size");
    console.dir(info);
});
job.on('exception', function(info) {
    console.log("exception");
    console.dir(info);
});
job.on('evict', function(info) {
    console.log("job evicted");
    console.dir(info);
});
job.on('release', function(info) {
    console.log("job released");
    console.dir(info);
});
job.on('hold', function(info) {
    console.log("job held"); //or timeout
    console.dir(info);
    //job.release();
});
job.on('terminate', function(info) {
    console.log("job terminateD");
    console.dir(info);
    if(info.ret == 0) {
        fs.readFile(job.stdout, 'utf8', function (err,data) {
            console.log(data);
        }); 
        fs.readFile(job.stderr, 'utf8', function (err,data) {
            console.log(data);
        }); 
        fs.readFile(job.rundir+"/output.txt", 'utf8', function(err, data) {
            if(err) throw err;
            console.log(data.substring(0, 3000));
        });
    } else {
        fs.readFile(job.stdout, 'utf8', function (err,data) {
            console.log(data);
        }); 
        fs.readFile(job.stderr, 'utf8', function (err,data) {
            console.log(data);
        }); 
    }
});

```

If you want to submit via grid universe.. or set any other condor options, pass condor object containing
all attributes that you want to set in the submit file.

```
var condor = {
    //setting universe
    universe: "grid",
    grid_resource: "gt2 ce.grid.iu.edu/jobmanager-condor"

    //or set any other condor options
    "+ProjectName": "CSIU",
    "+PortalUser": "hayashis",
    "Requirements": "(GLIDEIN_ResourceName =!= \"cinvestav\") && (GLIDEIN_ResourceName =!= \"SPRACE\") && (GLIDEIN_ResourceName =!= \"Nebraska\") && (HAS_CVMFS_oasis_opensciencegrid_org =?= True) && (Memory >= 2000) && (Disk >= 100*1024*1024)"
}
var workflow = new osg.Workflow();

var job = workflow.submit({
    executable: 'job.sh', //executable to send & run (usually a shell script)
    condor: condor
});
```

If you have any questions / suggestions, please contact me at hayashis@iu.edu



