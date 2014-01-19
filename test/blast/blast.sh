#!/bin/bash

wget http://osg-xsede.grid.iu.edu/scratch/iugalaxy/blastdb/nr.latest/nr.0.tar.gz
wget http://osg-xsede.grid.iu.edu/scratch/iugalaxy/blastdb/nr.latest/blast.opt
tar -xzf nr.0.tar.gz
rm nr.0.tar.gz #save a bit of disk space..

./blastx -query nr.100.fasta -db nr.00 -out output.xml -evalue 0.001 -outfmt 5 `cat blast.opt`
