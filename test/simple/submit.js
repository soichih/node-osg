var osg = require('../../index.js');
var fs = require('fs');
var path = require('path');

var temp = require('temp');

var condor = {
    //needed to run jobs on osg-xsede
    "+ProjectName": "CSIU",
    "+PortalUser": "hayashis",
    "Requirements": "(GLIDEIN_ResourceName =!= \"cinvestav\") && (GLIDEIN_ResourceName =!= \"SPRACE\") && (GLIDEIN_ResourceName =!= \"Nebraska\") && (HAS_CVMFS_oasis_opensciencegrid_org =?= True) && (Memory >= 2000) && (Disk >= 100*1024*1024)"
}

var workflow = new osg.Workflow();

var job = workflow.submit({
    executable: 'job.sh', //executable to send & run (usually a shell script)
    condor: condor,

    //timeout event will be fired after this timeout.
    //timer will start when job starts executing and stopped if it's held, or terminated
    timeout: 15*1000, 

    //set call back function to stage any input files (or symlink to the actual file)
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
job.on('timeout', function(info) {
    console.log("job timedout - removing");
    console.dir(info);
    //job.remove();
    job.hold();
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
    console.log("job held");
    console.dir(info);
    job.release();
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
