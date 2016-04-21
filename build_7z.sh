INSTALL_FILE="install.rdf"

XPI_INCLUDE_LIST="chrome defaults install.rdf chrome.manifest"
XPI_EXCLUDE_LIST="*svn* *swp*"
XPI_OUTPUT_PREFIX="cookieswap_"

#Find the line with the version and grab the value between the ">" and the ">"
APP_VER=`cat $INSTALL_FILE |grep "<em:version" |awk -F">" '{ print $2 }' |awk -F"<" '{print $1}'`
OUTPUT_FILE="$XPI_OUTPUT_PREFIX""$APP_VER"".xpi"

#Remove the old file if it exists
rm -f $OUTPUT_FILE

echo "Packaging version $APP_VER to $OUTPUT_FILE"

7z a -tzip $OUTPUT_FILE $XPI_INCLUDE_LIST -xr!*svn* -xr!*swp*

