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
    env: {name: "soichi"}, //env parameters used by run.js (part of wn)

    //receive: ['nothing'],
    condor: condor,
    //timeout: 15*1000, //(timer will stop if job terminates, hold, etc)
    //call to place files in rundir before submitting. any files / symlinks created here will be send to the remote job
    rundir: function(rundir, next) {
        console.log("using rundir:"+rundir);
        fs.symlink(path.resolve('job.js'), rundir+"/job.js", next);
    }
});
job.on('submit', function(info) {
    console.log("submitted");
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
    /*
    fs.readFile(job.options.output, 'utf8', function (err,data) {
        console.log(data);
    });
    fs.readFile(job.options.error, 'utf8', function (err,data) {
        console.log(data);
    });
    */
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
