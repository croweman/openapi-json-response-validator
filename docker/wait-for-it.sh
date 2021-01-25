#!/bin/sh
URL=$1

echo "URL is set to '$URL'";

r=$(wget --quiet --tries=1 --spider ${URL})

for i in 1 2 3 4 5
  do
    if [ $? -eq 0 ]; then
      echo "service is ready"
      break 
    fi
    echo "Readiness check for $URL: $i"
    sleep 4
    r=$(wget --quiet --tries=1 --spider ${URL}) 
  done

if [ $? -ne 0 ]; then
  echo "service unavailable"
  exit 1
fi