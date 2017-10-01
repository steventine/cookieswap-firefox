// *****************************************************************************
// *                        CookieProfile                                      *
// *                                                                           *
// ************************* BEGIN LICENSE BLOCK *******************************
// * Version: MPL 1.1                                                          *
// *                                                                           *
// *The contents of this file are subject to the Mozilla Public License Version*
// * 1.1 (the "License"); you may not use this file except in compliance with  *
// * the License. You may obtain a copy of the License at                      *
// * http://www.mozilla.org/MPL/                                               *
// *                                                                           *
// * Software distributed under the License is distributed on an "AS IS" basis,*
// * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License  *
// * for the specific language governing rights and limitations under the      *
// * License.                                                                  *
// *                                                                           *
// * The Original Code is the CookieSwap Mozilla/Firefox Extension             *
// *                                                                           *
// * The Initial Developer of the Original Code is                             *
// * Steven Tine.                                                              *
// * Portions created by the Initial Developer are Copyright (C) 2006          *
// * the Initial Developer. All Rights Reserved.                               *
// *                                                                           *
// * Contributor(s): Steven Tine                                               *
// *                                                                           *
// **************************END LICENSE BLOCK**********************************


//-------------CookieProfile class definition--------------
//This class abstracts the idea of how a profile is persistently stored.  This class
//  also knows how to copy cookies to/from the browser.
//Input: fileName - nsIFile object where the persistent info of this class is stored
function CookieProfile(profileName, activeProfileName)
{
   //Define a debug function for the class...change true/false to turn it on/off
   this.classDump=function(s){true ? cookieswap_dbg("[CookieProfile]" + s) : (s)}

   //This is the way to call the debug function
   this.classDump("START ctor");

   //--Create some attributes

   //We need to keep track of if this is the first time this profile is being
   //  swapped in for this running of the browser.  If the user just started
   //  the browser up and they are swapping in this profile for the first time,
   //  "session" cookies (one that expire at the end of the browser session) should
   //  not be swapped in (they should be deleted).
   //But, if the session cookies were swapped out to this profile in the same browser
   //  session, then they should be swapped in also.
   this.cookiesCameFromThisSession = false;

   //Profile Name attribute...will be set below if the file passed in is a valid
   //  profile.  Callers of this ctor can check the profileName for empty string
   //  to find if this creation failed.
   this.profileName = profileName; 

   //Attribte tracking if this profile is currently active
   this.activeState = false; 

   //If the file extension shows it as active, track it
   if (profileName === activeProfileName)
   {
      this.classDump("Profile is active");
      this.activeState = true; 
   }

   this.classDump("END ctor");
}

CookieProfile.prototype.getProfileName = function()
{
   return(this.profileName);
}

CookieProfile.prototype.getActiveState = function()
{
   return(this.activeState);
}

//--Changes the state of this profile being active or not
//  active_state = false, means this profile is no loger active
//  active_state = true, means this profile is now active
CookieProfile.prototype.setActiveState= function(active_state)
{
   if (this.activeState != active_state)
   {
      this.classDump("ActiveState change (and file name change) for " + this.profileName);

      //Active state change
      var fileHandle = this.fileName;

      //Set attribute
      this.activeState = active_state;

      //Renaming filename to indicate new active state
      this.fileName = CookieProfile_moveFile(this.fileName, CookieProfile_getLeafFileName(this.profileName, active_state));
  }
}

CookieProfile.prototype.clearAllCookies = function()
{
   //To clear all the cookies in this profile, create an empty file (which
   //  removes the old file) and then just close it.
   var file_stream = this.getEmptyFile();
   file_stream.close(); 
}

CookieProfile.prototype.getEmptyFile = function()
{
   var file_out_stream = ffGetFileOutputStream();

   //Create an empty file that will contain the profile's cookies
   this.classDump("opening " + this.fileName.leafName + " for writing");
   file_out_stream.init(this.fileName, COOKIE_FILE_WRITE_FLAGS, COOKIE_FILE_PERMISSIONS, 0);

   //Write the header to the file
   tmp_string = COOKIE_FILE_HDR;
   file_out_stream.write(tmp_string, tmp_string.length);

   this.classDump("Header written");

   return(file_out_stream);  //It is assumed the caller will call file_out_stream.close()
}

//NOTE this method will copy all the cookies in the Profile to the browser.  It
//  will NOT delete the cookies currently in the browser so the caller should
//  remove the browser cookies first if that is desired.
CookieProfile.prototype.copyToBrowser = function()
{
   var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                           .createInstance(Components.interfaces.nsIFileInputStream);
   var cookie_svc=ffGetCookieService();
   var i=0;
   var file_valid=true;
   
   this.classDump("Opening " + this.fileName.leafName + " file for reading");

   try
   {
      istream.init(this.fileName, COOKIE_FILE_READ_FLAGS, COOKIE_FILE_PERMISSIONS, 0);
      this.classDump("Open, converting to nsILineInputStream");
      istream.QueryInterface(Components.interfaces.nsILineInputStream);
   }
   catch (e)
   {
      this.classDump("init failed=>" + e);
      file_valid=false;
   }
 
   if (file_valid == true)
   {
      this.classDump("Open...reading");

      //read lines into array
      var line = {};
      var hasmore;
   
      do
      {
         hasmore = istream.readLine(line);
         var str_line = new String(line.value);  //Convert to a more convienent String object
     
         //this.classDump("DataRead(" + str_line.length + ")=" + str_line);

         //Make sure there is data on the line and it is not a comment
         if ((str_line.length > 0) && (str_line.charAt(0) != '#'))
         {
            var  curr_cookie = new cs_Cookie(str_line);
        
            if (curr_cookie.isValid == true)
            {
               //If the cookies in the profile file did not come from this session of the browser
               //  and they are session cookies, then we don't want to swap them in.
               if ((this.cookiesCameFromThisSession == false) && (curr_cookie.isSessionCookie() == true) )
               {
                  this.classDump("Excluding session cookie from swap because we are running a new" +
                                 "browser session (" + curr_cookie.getCookieString() + ")" );
               }
               else
               {
                  //this.classDump("Adding cookie=" + curr_cookie.getCookieUrl().spec + "=>" + curr_cookie.getCookieString());
                  var cookie_url = curr_cookie.getCookieUrl();
                  if (cookie_url.spec != "")
                  {
                     cookie_svc.setCookieString(cookie_url, 
                                                null, 
                                                curr_cookie.getCookieString(), 
                                                null);
                     i++;  //Increment the valid cookie count
                  }
                  else
                  {
                     this.classDump("Excluding cookie due to blank URL\n");
                  }               }
            }
            else
            {
               this.classDump("Non-comment line was invalid => " + str_line);
            }
         }
      } while(hasmore);
   
      this.classDump("Closing");
      istream.close();
   }
   else
   {
      alert("[CookieSwap] Warning, unable to locate file associated with selected profile.\n" +
            "Expected filename=" + this.fileName.leafName + "\n" +
            "Full path=" + this.fileName.path);
      this.classDump("Unable to open " + this.fileName.path);
   }

   this.classDump("Copied " + i + " cookies from the profile to the browser" );

}

//This method will copy all the cookies in the browser's memory to the
// persistent storage of this profile (replacing all that were
// currently in the storage)
CookieProfile.prototype.copyFromBrowser = function()
{
   var cookie_mgr = ffGetCookieManager();
   var cookie_iter = cookie_mgr.enumerator;
   var curr_cookie;
   var i;
   var file_out_stream = this.getEmptyFile();  //Empty file to store the cookies

   for (i=0;cookie_iter.hasMoreElements();i++)
   {
      curr_cookie = cookie_iter.getNext();

      //Cast the cookie (sorry for the "C" term) to an nsICookie
      if (curr_cookie instanceof Components.interfaces.nsICookie)
      {
          var tmp_string;
          var tmp_cookie;
   
          //this.classDump("Constructing new cookie");

          //Conver the cookie to a "cs_Cookie" class so we can get the FileString
          tmp_cookie = new cs_Cookie(curr_cookie);
          //this.classDump("I have the new cookie");

          //Append the cookie to the global cookie store
          tmp_string = tmp_cookie.getCookieFileString() + CS_NEW_LINE;
          file_out_stream.write(tmp_string, tmp_string.length);
      }
   }

   //Need to keep track that the cookies in the profile were taken from this
   //  running of the browser session.  See the attribute definition for more
   //  details on this.
   this.cookiesCameFromThisSession = true;

   this.classDump("Copied " + i + " cookies from browser to the profile file");
   file_out_stream.close();
}

//This "static" method will take in the profile name and provide a filename.
//  The name will differ if the profile is active (active=true) or not
function CookieProfile_getLeafFileName(profileName, active)
{
   var  file_extension;
   if (active == true)
   {
      file_extension = ACTV_COOKIE_FILE_EXT;
   }
   else
   {
      file_extension = INACT_COOKIE_FILE_EXT;
   }

   return(COOKIE_FILE_PREFACE + profileName + "." + file_extension);
}

//"Static" function to move a file
function CookieProfile_moveFile(fileHandle, newFileName)
{
   cookieswap_dbg("---move start (from '" + fileHandle.leafName + "' to '" +  newFileName + "')---");

   //Actually rename the file to the new name
   fileHandle.moveTo(null, newFileName);

   //On certain OSs (i.e. Linux), the call to moveTo does not update the fileHandle to point
   //  to the new file.  In that case, update it manually
   if (fileHandle.leafName != newFileName)
   {
      //Replace the existing filename portion of the path with the new filename portion of the path
      newFilePath = fileHandle.path.replace(fileHandle.leafName, newFileName);

      cookieswap_dbg("Needing to update fileHandle on this OS from '" + fileHandle.path + "' to '" + newFilePath);

      //Create a new nsIFile object and point it to the new file
      fileHandle = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
      fileHandle.initWithPath(newFilePath);
   }

   cookieswap_dbg("---move end---");
   return(fileHandle);
}

//"Static" function to copy a file
function CookieProfile_copyFile(fileHandle, newFileName)
{
   cookieswap_dbg("---copy start (from '" + fileHandle.leafName + "' to '" +  newFileName + "')---");

   //Actually rename the file to the new name
   fileHandle.copyTo(null, newFileName);

   cookieswap_dbg("---copy end---");
}

//This method removes the profile from existance.
//  The caller should not use this profile after calling this method
CookieProfile.prototype.remove = function()
{
   //The request is to remove this profile.  Delete the profile's file.
   this.fileName.remove(false);
}

//This method removes the profile from existance.
//  The caller should not use this profile after calling this method
CookieProfile.prototype.rename = function(newProfileName)
{
   //Make the name change
      
   var newFileName = CookieProfile_getLeafFileName(newProfileName, this.activeState);

   this.classDump("Moving:" + this.fileName.path + " to " + newFileName);
   this.fileName = CookieProfile_moveFile(this.fileName, newFileName);

   this.profileName = newProfileName;
}

//This method copies the profile file to a new file.
CookieProfile.prototype.copy = function(newProfileName)
{
   //Copy the file   
   var newFileName = CookieProfile_getLeafFileName(newProfileName, this.activeState);

   this.classDump("Copying:" + this.fileName.path + " to " + newFileName);
   CookieProfile_copyFile(this.fileName, newFileName);
}

// *****************************************************************************
// *                 PrivateBrowsingCookieProfile Class                        *
// * (implements the CookieProfile interface but does so with no file storage) *
// *                                                                           *
// ************************** Coding Standards *********************************
// *  gMyVariable     - global variable (starts with "g", then mixed case)     *
// *  myVariable      - variables passed into functions                        *
// *  my_variable     - local variable inside of a function                    *
// *  this.myVariable - class attributes/variable (mixed case & always         *
// *                    referenced with "this.")                               *
// *  MyFunction      - functions are always mixed case                        *
// *  MY_CONSTANT     - constants are all caps with underscores                *
// *                                                                           *
// *************************** Revision History ********************************
// *  Name       Date       BugzID  Action                                     *
// *  ---------  ---------  -----   ------                                     *
// *  SteveTine  28Dec2005  12561   Initial Creation                           *
// *  SteveTine  11Jan2006  12720   Fixing the way session cookies are handled *
// *  SteveTine  30Sep2006  15281   Adding setFileHandle method                *
// *  SteveTine  16Jan2006  Trac9   Create cs_Cookie instead of Cookie class   *
// *                                                                           *
// ************************* BEGIN LICENSE BLOCK *******************************
// * Version: MPL 1.1                                                          *
// *                                                                           *
// *The contents of this file are subject to the Mozilla Public License Version*
// * 1.1 (the "License"); you may not use this file except in compliance with  *
// * the License. You may obtain a copy of the License at                      *
// * http://www.mozilla.org/MPL/                                               *
// *                                                                           *
// * Software distributed under the License is distributed on an "AS IS" basis,*
// * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License  *
// * for the specific language governing rights and limitations under the      *
// * License.                                                                  *
// *                                                                           *
// * The Original Code is the CookieSwap Mozilla/Firefox Extension             *
// *                                                                           *
// * The Initial Developer of the Original Code is                             *
// * Steven Tine.                                                              *
// * Portions created by the Initial Developer are Copyright (C) 2006          *
// * the Initial Developer. All Rights Reserved.                               *
// *                                                                           *
// * Contributor(s): Steven Tine                                               *
// *                                                                           *
// **************************END LICENSE BLOCK**********************************

//-------------PrivateBrowsingCookieProfile class definition--------------
//This class abstracts the idea of how a profile is persistently stored.  This class
//  also knows how to copy cookies to/from the browser.
//Input: fileName - nsIFile object where the persistent info of this class is stored
function PrivateBrowsingCookieProfile(fileName)
{
   //Define a debug function for the class...change true/false to turn it on/off
   this.classDump=function(s){true ? cookieswap_dbg("[PrivateBrowsingCookieProfile]" + s) : (s)}

   //This is the way to call the debug function
   this.classDump("START ctor");

   //--Create some attributes
   //nsIFile object identifying where the persistent info of this class is stored
   this.fileName = fileName;

   //Profile Name attribute...will be set below if the file passed in is a valid
   //  profile.  Callers of this ctor can check the profileName for empty string
   //  to find if this creation failed.
   this.profileName = ""; 

   //Attribte tracking if this profile is currently active
   this.activeState = false; 

   //Convert to convient String
   var leaf_name  = new String(fileName.leafName);
   this.classDump("--CookieProfile file name is =" + leaf_name);

   //Now split off the preface of the filename used for cookie files
   var fname_split = leaf_name.split(COOKIE_FILE_PREFACE);
   this.classDump("Num of split is " + fname_split.length);
    
   //If the split found the preface, then the file is likely a cookie file
   if (fname_split.length > 1)
   {
      //Now split off the extension so we can get the extension and the profile name
      //  If we find more than that, the file is not valid...likely a swap file
      //  left around when someone edited the valid cookie file
      var  split_prof_name = fname_split[1].split(".");

      //At this point, split_prof_name[0 to len-1]=ProfileName, 
      //  split_prof_name[split_prof_name.length-1]=file extension
      //  (this is because there can be multiple dots in the profile)
      //  if there are not at least 2 splits in the filename, then it's not valid
      if(split_prof_name.length >= 2)
      {
         //This function removes the last element from the array (the file extension)
         //  and puts it in profile_ext array.  split_prof_name has the extension portion removed.
         var  profile_ext = split_prof_name.splice(split_prof_name.length-1); 
         //Also convert the only element to a simple string
         profile_ext = profile_ext[0];
 
         //We have a valid cookie profile file...set the attribute
         //Now join the remaining strings with a period (the only time this happens is
         //  when there is a period in the profile_name)
         this.profileName = split_prof_name.join("."); 

         this.classDump("Profile Name=" + this.profile_name + ", ext=" + profile_ext);

         //If the file extension shows it as active, track it
         if (profile_ext == ACTV_COOKIE_FILE_EXT)
         {
            this.classDump("Profile is active");
            this.activeState = true; 
         }
      }
   }

   //This is the temporary (in memory only) array of the cookies.
   //  In private browsing, there is no persistent file storage of cookies
   this.cookieArray = new Array();

   this.classDump("END ctor");
}

//Returns NsIFile
PrivateBrowsingCookieProfile.prototype.getFileHandle = function()
{
   return(this.fileName);
}

//Sets the NsIFile
PrivateBrowsingCookieProfile.prototype.setFileHandle = function(newFile)
{
   this.fileName = newFile;
}

PrivateBrowsingCookieProfile.prototype.getProfileName = function()
{
   return(this.profileName);
}

PrivateBrowsingCookieProfile.prototype.getActiveState = function()
{
   return(this.activeState);
}

//--Changes the state of this profile being active or not
//  active_state = false, means this profile is no loger active
//  active_state = true, means this profile is now active
PrivateBrowsingCookieProfile.prototype.setActiveState= function(active_state)
{
   //Set attribute only
   //NO file name change in private browsing because the filename that is showing active is still
   //  active when we leave private browsing.
   this.classDump("ActiveState change (NO file name change in private browsing) for " + this.profileName);
   this.activeState = active_state;
}

PrivateBrowsingCookieProfile.prototype.clearAllCookies = function()
{
   //To clear all the cookies in this profile, create a new array
   this.cookieArray = new Array();
}

PrivateBrowsingCookieProfile.prototype.getEmptyFile = function()
{
   //Not relevant for the PrivateBrowsing version of the class
}

//NOTE this method will copy all the cookies in the Profile to the browser.  It
//  will NOT delete the cookies currently in the browser so the caller should
//  remove the browser cookies first if that is desired.
PrivateBrowsingCookieProfile.prototype.copyToBrowser = function()
{
   var cookie_svc=ffGetCookieService();
   var x;
  
   for (x in this.cookieArray)
   {
      //One by one copy the cookies from the array into Browser Memory
      var  curr_cookie = this.cookieArray[x];
        
      cookie_svc.setCookieString(this.cookieArray[x].CookieUrl, 
                                 null, 
                                 this.cookieArray[x].CookieString, 
                                 null);
   }

   this.classDump("Copied private cookies from the profile to the browser" );

}

//This method will copy all the cookies in the browser's memory to the
// persistent storage of this profile (replacing all that were
// currently in the storage)
PrivateBrowsingCookieProfile.prototype.copyFromBrowser = function()
{
   //Clear the array
   var cookie_mgr = ffGetCookieManager();
   var cookie_iter = cookie_mgr.enumerator;
   var curr_cookie;
   var i;

   this.cookieArray = new Array();
   for (i=0;cookie_iter.hasMoreElements();i++)
   {
      curr_cookie = cookie_iter.getNext();

      //Cast the cookie (sorry for the "C" term) to an nsICookie
      if (curr_cookie instanceof Components.interfaces.nsICookie)
      {
          //One by one copy the cookies from the browser into the array 
          var tmp_cookie;
          var cookie_url;

          //this.classDump("Constructing new cookie");

          //Conver the cookie to a "cs_Cookie" class so we can get the FileString
          tmp_cookie = new cs_Cookie(curr_cookie);

          cookie_url = tmp_cookie.getCookieUrl();
          if (cookie_url.spec != "")
          {
             //Append the cookie to the global cookie store
             this.cookieArray[i] = new Object();
             this.cookieArray[i].CookieUrl = cookie_url;
             this.cookieArray[i].CookieString = tmp_cookie.getCookieString();
          }
          else
          {
             this.classDump("Excluding cookie due to blank URL\n");
          }
      }
   }

   this.classDump("Copied " + i + " cookies from browser to the private profile");
}

//This method removes the profile from existance.
//  The caller should not use this profile after calling this method
PrivateBrowsingCookieProfile.prototype.remove = function()
{
   //Not valid when private browsing
}

//This method removes the profile from existance.
//  The caller should not use this profile after calling this method
PrivateBrowsingCookieProfile.prototype.rename = function(newProfileName)
{
   //Not valid when private browsing
}

