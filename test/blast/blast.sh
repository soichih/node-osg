#!/bin/bash

dbname=nr.0
dburl=http://osg-xsede.grid.iu.edu/scratch/iugalaxy/blastdb/nr.latest/$dbname.tar.gz
dbopturl=http://osg-xsede.grid.iu.edu/scratch/iugalaxy/blastdb/nr.latest/blast.opt

echo "blast.sh listing"
ls -la

#enable osg client tool
export PATH=$PATH:./

osg set-httpproxy
echo "setting data"
osg data $dburl $dbname
wget $dbopturl

#limit memory at 2G
ulimit -v 2048000

export BLASTDB=$dbdir
time ./blastx -query nr.100.fasta -db nr.00 -out output.xml -evalue 0.001 -outfmt 5 `cat blast.opt`
blast_ret=$?

#check for output 
if [ $blast_ret -eq 0 ]; then
    echo "validating output"
    xmllint --noout --stream output.xml
    if [ $? -ne 0 ]; then
        echo "xml is malformed (probably truncated?).."
        exit 128
    fi
fi

#report return code
case $blast_ret in
0)
    echo "all good"
    ;;
1)
    echo "Error in query sequence(s) or BLAST options"
    ;;
2)
    echo "Error in blast database"
    ;;
3)
    echo "Error in blast engine"
    ;;
4)
    echo "out of memory"
    ;;
127)
    echo "no blastp"
    ;;
137)
    echo "probably killed by SIGKILL(128+9).. out of memory / preemption / etc.."
    ;;
*)
    echo "unknown error code: $blast_ret"
    ;;
esac

exit $blast_ret
