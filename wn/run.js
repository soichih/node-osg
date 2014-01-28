var extend = require('util')._extend;
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var fs = require('fs');

console.log("run.js: initializing");

//parse out command line arguments
var options_path = process.argv[2];
var cmd = process.argv.slice(3);

//console.log("running in :"+process.cwd());

//load options json
var options_json = fs.readFileSync(options_path, {encoding: 'utf8'});
var options = JSON.parse(options_json);
//console.log("dumping options");
//console.dir(options);

//env
var env = extend(process.env, options.env);
//console.log("dumping env");
//console.dir(env);

//doesn't seem to work
//exec("ulimit -v 300000");

//ignore first 2 since it's node / condor.exec
function run(cmd) {
    console.log("run.js: running cmd:"+cmd);

    //kill job
    var job_timeout = null;
    if(options.timeout) {
        job_timeout = setTimeout(function() {
            console.error("reached timeout.. sending SIGTERM");
            job.kill('SIGTERM');
        }, options.timeout*1000);
    }

    console.log("running");
    console.dir(cmd);
    job = spawn(cmd[0], cmd.slice(1), {env: env});//, {cwd: __dirname});
    job.stdout.on('data', function (data) {
        process.stdout.write(data);
    });
    job.stderr.on('data', function (data) {
        process.stderr.write(data);
    });
    job.on('exit', function(code, signal) {
        console.log("run.js: processed ended code:"+code+" signal:"+signal);
        if(job_timeout) {
            clearTimeout(job_timeout);
        }

        //TODO - I am not sure if I should stay running or not.. but for now let's quit
        process.exit(code);
    });
    job.on('error', function (err) {
        console.error("spawning error");
        console.error(err);

        //TODO - I am not sure if I should stay running or not.. but for now let's quit
        process.exit(1);
    });
};

run(cmd);

//console.dir(options);
//console.dir(process.env);

