#!/bin/bash

ls -lart /cvmfs/oasis.opensciencegrid.org

export PATH=$PATH:/cvmfs/oasis.opensciencegrid.org/osg/projects/OSG-Staff/rhel6/x86_64/node-v0.10.25-linux-x64/bin
node job.js
