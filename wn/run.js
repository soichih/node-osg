#!./node
//var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

console.log("I am run.js");

//ignore first 2 since it's node / condor.exec
function run(options) {
    condor_submit = spawn(options[0], options.slice(1));//, {cwd: __dirname});
    condor_submit.stdout.on('data', function (data) {
        process.stdout.write(data);
    });
    condor_submit.stderr.on('data', function (data) {
        process.stderr.write(data);
    });
    condor_submit.on('exit', function (code, signal) {
        console.log("processed ended code:"+code+" signal:"+signal);
    });
    condor_submit.on('error', function (err) {
        console.error("spawning error");
        console.error(err);
    });
    /*
    job = exec(cmd, {
        encoding: 'utf8',
        timeout: 0, //in milliseconds
        maxBuffer: 200*1024,
        killSignal: 'SIGTERM',
        cwd: null,
        env: null
    }, function(error, stdout, stderr) {
        process.stdout.write(stdout);
        process.stderr.write(stderr);
        if(error !== null) {
            console.error(error);
        }
        //TODO - what to do now?
    });
    */
};

var options = process.argv.slice(2);
//var cmd = process.argv.slice(2).join(" ");
console.log("running: "+options);
run(options);

//console.dir(options);
//console.dir(process.env);

