var osg = require('../../index.js');
var fs = require('fs');
var path = require('path');

var temp = require('temp');

var condor = {
    //needed to run jobs on osg-xsede
    "+ProjectName": "CSIU",
    "+PortalUser": "hayashis",
    "Requirements": "(GLIDEIN_ResourceName =!= \"cinvestav\") && (GLIDEIN_ResourceName =!= \"SPRACE\") && (GLIDEIN_ResourceName =!= \"Nebraska\") && (HAS_CVMFS_oasis_opensciencegrid_org =?= True) && (Memory >= 2000) && (Disk >= 500*1024*1024)"
}

var events = osg.submit({
    executable: 'job.sh', //executable to send & run (usually a shell script)
    env: {name: "soichi"}, //env parameters used by run.js (part of wn)

    condor: condor,
    timeout: 60*10, //kill job in 10 minutes (should take less than seconds to run)
    //call to place files in rundir before submitting. any files / symlinks created here will be send to the remote job
    prepare: function(rundir, next) {
        console.log("using rundir:"+rundir);
        fs.symlink(path.resolve('job.js'), rundir+"/job.js", next);
    }
});

events.on('submit', function(job, info) {
    console.log("submitted");
    console.dir(info);
});
events.on('execute', function(job, info) {
    console.log("job executing");
    console.dir(info);
    osg.q(job).then(function(data) {
        console.log("running on "+data.MATCH_EXP_JOB_Site);
    });
});
events.on('progress', function(job, info) {
    console.log("progressing / image_size");
    console.dir(info);
});
events.on('exception', function(job, info) {
    console.log("exception");
    console.dir(info);
    fs.readFile(job.options.output, 'utf8', function (err,data) {
        console.log(data);
    });
    fs.readFile(job.options.error, 'utf8', function (err,data) {
        console.log(data);
    });
});
events.on('evict', function(job, info) {
    console.log("job evicted");
    console.dir(info);
});
events.on('terminate', function(job, info) {
    console.dir(info);
    if(info.ret == 0) {
       fs.readFile(info.rundir+"/output.txt", 'utf8', function(err, data) {
            if(err) throw err;
            console.log(data.substring(0, 3000));
        });
    } else {
        fs.readFile(job.options.output, 'utf8', function (err,data) {
            console.log(data);
        }); 
        fs.readFile(job.options.error, 'utf8', function (err,data) {
            console.log(data);
        }); 
    }
});
