function osg() {
    return function() {
    };
};

var count_job = {
    input: ['count.js', 'walden.txt'],
    output: ['count.txt'],
    run: 'count.js walden.txt > count.txt',
};
var sort_job = {
    input: ['count.txt'],
    output: ['count.sorted.txt'],
    run: 'sort count.txt > count.sorted.txt',
};

var retry_count = 3;
function count() {
    osg.submit({
        //jobs to submit together. each job will be given a unique process id via ENV
        jobs: [count_job],

        //resource requirements
        memory: 2000, //max memory in Mbytes
        timeout: 60, //max execution time in seconds

        oncomplete: function() {
            //submit aggregator
            osg.submit({
            }).then(); 
        },
        onheld: function() {
            if(retry_count--) {
                console.log("failed to run count.js.. rerunning");
                count();
            }
        }
    });
}

