//The observer topic used during notifies from this component
const COOKIE_SWAP_OBSERVER_TOPIC = "cookie_swap";

//The observer data used during notifies from this component
const COOKIE_SWAP_RELOAD_DATA = "?RELOAD?";
const COOKIE_SWAP_PRIV_BROWSING_DATA = "?PRIV_BROWSING?";  //Also a boolPref
const COOKIE_SWAP_NOT_PRIV_BROWSING_DATA = "?NOT_PRIV_BROWSING?";

const COOKIE_SWAP_VER_DATA = "?VERSION?";  //For getCharPref

//-------------------------------
//Meaning of the network.cookie.cookieBehavior setting
const COOKIE_BEHAVIOR_ACCEPT_ALL = 0;
const COOKIE_BEHAVIOR_DISALLOW_THIRD_PARTY = 1;
const COOKIE_BEHAVIOR_DISABLE_COOKIES = 2;

//These are the constants used in the cookieswap_swap observer 'subject'
const COOKIE_SWAP_OBSVR_NEW_ACTIVE_PROFILE=1;
const COOKIE_SWAP_OBSVR_NEW_PROFILE_LIST=2;

//Exceptions we throw
const ATTEMPT_TO_DELETE_ACTIVE_PROFILE = "Can't delete the active profile";
const INTERNAL_ERROR = "Unspecified internal error";

var gCookieSwapVersionNumber=null;

const PROF_ARRAY_REGULAR_BROWSING_INDEX = 0;
const PROF_ARRAY_PRIVATE_BROWSING_INDEX = 1;
var gCookieProfileMgrArray = null;

function CookieSwapVersionNumber() {  
  //Initialize the version number store
  cookieswap_initializeVersion(this);
}

function cookieswap_initializeVersion(self)
{
  cookieswap_dbg("Entering...cookieswap_initializeVersion()\n");

  //This is called async, so it may be some time before this variable is set correctly.
  //TODO: Need to find the version number
  self._version = "1.0";
  cookieswap_dbg("CookieSwap version is " + self._version + "\n");

  cookieswap_dbg("Exiting...cookieswap_initializeVersion()\n");
  return;
}

//class definition
CookieSwapVersionNumber.prototype = {
  _version: "<unknown>"
};

function initCookieManagerModule() {
   if (gCookieSwapVersionNumber == null)
   {
      //First time that init is called
	  
	  //Initialize the logger
      cookieswap_loggerInit();
	  
	  //Create the profile manager array
	  gCookieProfileMgrArray = new Array();
	  gCookieProfileMgrArray[PROF_ARRAY_PRIVATE_BROWSING_INDEX] = new Object();
	  gCookieProfileMgrArray[PROF_ARRAY_PRIVATE_BROWSING_INDEX].profileMgr = null;
	  gCookieProfileMgrArray[PROF_ARRAY_PRIVATE_BROWSING_INDEX].refCount = 0;
	  
	  gCookieProfileMgrArray[PROF_ARRAY_REGULAR_BROWSING_INDEX] = new Object();
	  gCookieProfileMgrArray[PROF_ARRAY_REGULAR_BROWSING_INDEX].profileMgr = null;
	  gCookieProfileMgrArray[PROF_ARRAY_REGULAR_BROWSING_INDEX].refCount = 0;
	  
	  //Create the CookieSwapVersionNumber holder
      gCookieSwapVersionNumber = new CookieSwapVersionNumber();
   }
   
   return;
}
  
function getCookieSwapVersion(){
   return(gCookieSwapVersionNumber._version);
}

//This is the only exported method from this module.  It manages the instances of
// the CookieSwapProfileManagers.  There are two CookieSwapProfileManagers:
//  isPrivate=true is the profile manager used when in private browsing
//  isPrivate=false is the profile manager used when in normal (non-private) browsing
function getCookieSwapProfileMgrModule(isPrivate) {
   var index;
   if (isPrivate)
   {
      //Request is for the Private mode CookieSwapProfileMgr
      index=PROF_ARRAY_PRIVATE_BROWSING_INDEX;
   }
   else
   {
      //Request is for the normal (non-Private) mode CookieSwapProfileMgr
      index=PROF_ARRAY_REGULAR_BROWSING_INDEX;
   }
   
   if (gCookieProfileMgrArray[index].profileMgr == null)
   {
       gCookieProfileMgrArray[index].profileMgr = new CookieSwapProfileMgr(isPrivate);
       gCookieProfileMgrArray[index].refCount = 0;
   }
   gCookieProfileMgrArray[index].refCount++;
   return (gCookieProfileMgrArray[index].profileMgr);   
 }
 
function anyOpenPrivateBrowsingWindows() 
{
    //If we have any private profile managers then we have at least one window in private browsing state
    return(gCookieProfileMgrArray[PROF_ARRAY_PRIVATE_BROWSING_INDEX].refCount > 0);
}

//This is called when a ProfileManger is no longer needed.  Once all references
//  have been released, the ProfileManager can be released.
function releaseCookieSwapProfileMgrModule(profMgr){
 cookieswap_dbg("releaseCookieSwapProfileMgrModule\n");
 
  for (i=0;i<gCookieProfileMgrArray.length;i++)
  {
     if(gCookieProfileMgrArray[i].profileMgr == profMgr)
	 {
	    cookieswap_dbg("Found profile mgr at index " + i + " with refcount of " + gCookieProfileMgrArray[i].refCount);
	    //Is this the last outstand reference?
		gCookieProfileMgrArray[i].refCount--;
	    if(gCookieProfileMgrArray[i].refCount <= 0)
	    {
	        //This is the last reference needed of this type of profile manager.

	        //-------TEMPORARY...per ticket #88------
	        if (i == PROF_ARRAY_PRIVATE_BROWSING_INDEX)
	        {
	            //-------FF19 and earlier had a global Private Browsing mode
	            //-------FF20 and later had per window Private Browsing but doesn't have a CookieManager
	            //            that allows you to manipulate the priv/pub cookie store independently
	            var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                                      .getService(Components.interfaces.nsIXULAppInfo);
	            var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                                             .getService(Components.interfaces.nsIVersionComparator);
	            if(versionChecker.compare(appInfo.version, "20") >= 0) 
	            {
	                //Per ticket #88: In FF 20 (which has per window priv browsing)
	                //  we have to treat the entire browser as being in private browsing
	                //  whenever at least 1 window is private browsing because the CookieManager
	                //  doesn't allow you to change only the private or public cookie store.
	                //However, this is the last window in private browsing, so we can now tell
                    //  the regular windows that we are no longer in private browsing.
	                //See Mozilla bug https://bugzilla.mozilla.org/show_bug.cgi?id=777620
	                cookieswap_dbg("In FF20+ and last priv browsing window is gone.  Notify regular windows of NOT PRIV browsing");
	                if(gCookieProfileMgrArray[PROF_ARRAY_REGULAR_BROWSING_INDEX].profileMgr != null)
	                {
	                    gCookieProfileMgrArray[PROF_ARRAY_REGULAR_BROWSING_INDEX].profileMgr.notifyObserversOfNotPrivBrowsing();
	                }
	            }
	        }

  		    cookieswap_dbg("Destroying profile mgr at index " + i);
		    //No longer needed...release it for the garbage collector
			gCookieProfileMgrArray[i].profileMgr = null;
		}
	 }
  }
} 
 
//class constructor
//  isPrivate=true is the profile manager used when in private browsing
//  isPrivate=false is the profile manager used when in normal (non-private) browsing
function CookieSwapProfileMgr(isPrivate) {
  cookieswap_dbg("CookieSwapProfileMgr(" + isPrivate + ") ctor\n");
	 
  //Now get the CookieProfileContainer singleton which initializes it
  this._profileContainer = new CookieProfileContainer(isPrivate);

  //Show the currently active profile as active on the UI
  this._currentProfile = this._profileContainer.getActiveProfileId();
  
  
  cookieswap_dbg("CookieSwapProfileMgr ctor complete\n");
};


//class definition
CookieSwapProfileMgr.prototype = {
  _currentProfile: null,
  _profileContainer: null,
  _version: "<unknown>",
  _isPrivate: false,

  //--------------------------------------------------------
  //property of nsIProfile interface (setter/getter methods)
  //--------------------------------------------------------
  get currentProfile() { return this._currentProfile; },
  set currentProfile(aValue) { this.changeCurrentProfile(aValue); },
  get profileCount() { return this._profileContainer.getNumOfProfiles(); },
  
  //-------------------------------
  //methods of nsIPrefBranch interface
  //-------------------------------

  //----getBoolPref-----
  getBoolPref: function(prefName) {
    cookieswap_dbg("getBoolPref(" + prefName + ")\n");
    var  bool_ret_val;
    if (prefName == COOKIE_SWAP_PRIV_BROWSING_DATA)
    {
       bool_ret_val = this._profileContainer.getPrivBrowsing();
    }
    return bool_ret_val;
  },

  //----getCharPref-----
  getCharPref: function(prefName) {
    cookieswap_dbg("getCharPref(" + prefName + ")\n");
    var  char_ret_val;
    if (prefName == COOKIE_SWAP_VER_DATA)
    {
       //CookieSwap version number
       char_ret_val = this._version;
    }
   cookieswap_dbg("Pref value returned is '" + char_ret_val + "'\n");
   return char_ret_val;
  },



  //-------------------------------
  //methods of nsIProfile interface
  //-------------------------------

  //----cloneProfile-----
  //In cookieSwap...we don't know the profile being cloned so we squeeze the
  //  original profile name and new profile name into the "profName" and split it using
  //  a seemingly impossible valid name delimiter " , "
  //So profName is "oldProfileName , newProfName" (with <space> <comma> <space> inbetween)  
  cloneProfile: function(profName) {
    cookieswap_dbg("cloneProfile " + profName + "\n");
    
    var split_string = profName.split(" , ");
    if (split_string.length > 1)
    {
       var oldProfName = split_string[0];
       var newProfName = split_string[1];

       cookieswap_dbg("Request to copy " + oldProfName + " to " + newProfName + "\n");
       var profile_num = this._profileContainer.getProfileNum(oldProfName);
       if(profile_num != INVALID_PROFILE_NUM)
       {
          //Go ahead and copy the profile
          cookieswap_dbg("Copying profile:" + oldProfName + " (" + profile_num + ") to " + newProfName + "\n");
          if (this._profileContainer.copyProfile(profile_num, newProfName) == true)
          {
             this._currentProfile = this._profileContainer.getActiveProfileId();
             this.notifyObserversOfNewProfileList();
          }
       }
       else
       {
          cookieswap_dbg("Request to copy invalid profile: " + oldProfName + "\n");
          throw(INTERNAL_ERROR);
       }
    }
    else
    {
       cookieswap_dbg("Split failed with only " + split_string.length  + " strings returned\n");
       throw(INTERNAL_ERROR);
    }

    return;
  },    

  //-------------------------------
  //methods of nsIObserver interface
  //-------------------------------
  observe: function (aSubject, aTopic, aData) {
    cookieswap_dbg("observe method in CookieSwapProfManager unimplemented Topic=" + aTopic + "\n");
    //Unimplemented, we could throw an exception
    //throw("cloneProfile unimplemented");
    return;
  },

  //---createNewProfile-----
  //---Only use the profName for CookieSwap
  createNewProfile: function(profName, profDir, langCode, useExistingDir) {
    cookieswap_dbg("Creating" + profName + "\n");
    if (this._profileContainer.addProfile(profName) == true)
    {
       this.notifyObserversOfNewProfileList();
    }
  },

  //---deleteProfile-----
  //---CookieSwap changes the definition of this method slightly.  If
  //---  canDeleteFile is true then the profile is completely deleted and
  //---  removed as a profile.  If canDeleteFile is false, then the contents
  //---  (i.e. cookies) of the profile are deleted, but the profile still
  //---  exists.
  deleteProfile: function(profName, canDeleteFile) {
    cookieswap_dbg("Deleting" + profName + "\n");
    if (canDeleteFile == true)
    {
       //Request to delete the entire profile
       if (profName != this._currentProfile)
       {
          var profile_num = this._profileContainer.getProfileNum(profName);
          if(profile_num != INVALID_PROFILE_NUM)
          {
             //Go ahead and delete the profile
             cookieswap_dbg("Deleting profile:" + profName + " (" + profile_num + ")\n");
             if (this._profileContainer.removeProfile(profile_num) == true)
             {
                this._currentProfile = this._profileContainer.getActiveProfileId();
                this.notifyObserversOfNewProfileList();
             }
             else
             {
                cookieswap_dbg("removeProfile() call failed");
             }
          }
          else
          {
             cookieswap_dbg("Request to delete invalid profile: " + profName + "\n");
          }
       }
       else
       {
          cookieswap_dbg("Request to delete active profile");
          throw(ATTEMPT_TO_DELETE_ACTIVE_PROFILE);
       }
    }
    else
    {
       //Request to delete the cookies in this profile
       cookieswap_dbg("Deleting cookies associated with " + profName + "\n");
       var req_profile = this._profileContainer.getProfile(profName);
       if (req_profile != null)
       {
          //Clear all cookies in the requested profile
          req_profile.clearAllCookies();
       }
       else
       {
          cookieswap_dbg("Invalid profile name [" + profName + "] passed in\n");
       }
    }

  },

  //---getProfileList-----
  getProfileList: function (obj) {
    var profileList = {
          profiles: new Array(),
          activeProfile: 0
      };

    //Populate the UI with the profiles available
    for(var i=0; i<this._profileContainer.getNumOfProfiles(); i++)
    {
       profileList.profiles[i] = this._profileContainer.getProfileName(i);
       cookieswap_dbg("Returning profile: " + profileList.profiles[i]);
    }
    profileList.activeProfile = this._profileContainer.getActiveProfileId();

    return (profileList);
  },
  
  //---profileExists-----
  profileExists: function(profName) {
    var profile_num = this._profileContainer.getProfileNum(profName);
    if(profile_num != INVALID_PROFILE_NUM)
        return true;
    else
        return false; 
  },

  //---renameProfile-----
  renameProfile: function(oldProfName, newProfName) {
    cookieswap_dbg("Request to rename from " + oldProfName + " to " + newProfName + "\n");
    var profile_num = this._profileContainer.getProfileNum(oldProfName);
    if(profile_num != INVALID_PROFILE_NUM)
    {
       //Go ahead and delete the profile
       cookieswap_dbg("Renaming profile:" + oldProfName + " (" + profile_num + ") to " + newProfName + "\n");
       if (this._profileContainer.renameProfile(profile_num, newProfName) == true)
       {
          this._currentProfile = this._profileContainer.getActiveProfileId();
          this.notifyObserversOfNewProfileList();
       }
    }
    else
    {
       cookieswap_dbg("Request to delete invalid profile: " + oldProfName + "\n");
    }

  },
  
  //---shutDownCurrentProfile-----
  shutDownCurrentProfile: function(type) {
    cookieswap_dbg("Shutdown type= " + type + "\n");
  },

  //--------------------------------------------------------------------------
  //Private methods of CookieSwapProfileMgr (not part of an exposed Interface)
  //--------------------------------------------------------------------------
  //---setPrivBrowsingState (only happens in FF19 and earlier)-----
  setPrivBrowsingState: function(newPrivBrowsingState) {
    cookieswap_dbg("Setting Priv Browsing state to " + newPrivBrowsingState + "\n");

    if (this._isPrivate != newPrivBrowsingState)
    {
       cookieswap_dbg("Changing Priv Browsing state to " + newPrivBrowsingState + "\n");
	   
	   this._isPrivate = newPrivBrowsingState
	   
	   //Create a new profileContainer with the new browsing state
       this._profileContainer = new CookieProfileContainer(this._isPrivate);
       
       //To be safe, notify all windows of new profiles and new active profile.
	   //For example, this can happen when leaving private browsing and the profiles
       //  that was active when the user entered private browsing is again active.
       this._currentProfile = this._profileContainer.getActiveProfileId();
       this.notifyObserversOfNewProfileList();
       this.notifyObserversOfSwap(this._currentProfile);

       if (this._isPrivate == true)
       {
          this.notifyObserversOfPrivBrowsing();
       }
       else
       {
          this.notifyObserversOfNotPrivBrowsing();
       }
    }
	cookieswap_dbg("Change to Priv Browsing state complete");
  },

  //----notifyObserversOfSwap-----
  notifyObserversOfSwap: function(profName) {
     //Create a wrappedJSObject for the subject
      var subj = {
          cookieSwapProfileMgr : this,
          extraData: null
     };
     subj.wrappedJSObject = subj;

     //Notify all the observers of the new profiles swapped in
     Components.classes["@mozilla.org/observer-service;1"]
         .getService(Components.interfaces.nsIObserverService)
         .notifyObservers(subj, "cookieswap_swap", profName);
  },

  //----notifyObserversOfNewProfileList-----
  notifyObserversOfNewProfileList: function() {
      //Create a wrappedJSObject for the subject
      var subj = {
          cookieSwapProfileMgr : this,
          extraData: null
      };
      subj.wrappedJSObject = subj;

     //Notify all the observers of the new profile list
     Components.classes["@mozilla.org/observer-service;1"]
         .getService(Components.interfaces.nsIObserverService)
         .notifyObservers(subj, "cookieswap_swap", COOKIE_SWAP_RELOAD_DATA);
  },

  //----notifyObserversOfPrivBrowsing-----
  notifyObserversOfPrivBrowsing: function() {
       //Create a wrappedJSObject for the subject
      var subj = {
          cookieSwapProfileMgr : this,
          extraData: null
      };
      subj.wrappedJSObject = subj;

     //Notify all the observers that we are private browsing
     Components.classes["@mozilla.org/observer-service;1"]
         .getService(Components.interfaces.nsIObserverService)
         .notifyObservers(subj, "cookieswap_swap", COOKIE_SWAP_PRIV_BROWSING_DATA);
  },

  //----notifyObserversOfNotPrivBrowsing-----
  notifyObserversOfNotPrivBrowsing: function() {
      //Create a wrappedJSObject for the subject
      var subj = {
          cookieSwapProfileMgr : this,
          extraData: null
      };
      subj.wrappedJSObject = subj;

     //Notify all the observers that we are private browsing
     Components.classes["@mozilla.org/observer-service;1"]
         .getService(Components.interfaces.nsIObserverService)
         .notifyObservers(subj, "cookieswap_swap", COOKIE_SWAP_NOT_PRIV_BROWSING_DATA);
  },

  //----changeCurrentProfile-----
  changeCurrentProfile: function(profName) {
    cookieswap_dbg("changeCurrentProfile to " + profName + "\n");
    this._currentProfile = profName;

   cookieswap_dbg("START switchProfile to " + profName);

   var old_profile_id = this._profileContainer.getActiveProfileId();
   var new_profile_id = profName;

   //First thing to do is copy all the cookies from the browser and
   //  save them to the profile being swapped out
   if (old_profile_id != INVALID_PROFILE_ID)
   {
      cookieswap_dbg("Starting copyFromBrowser");
      var old_profile = this._profileContainer.getProfile(old_profile_id);
      old_profile.copyFromBrowser();
   }
   else
   {
      //The only normal case where this should happen is if the browser crashes
      //  during a swap and we come up and no profiles are active.  On the next
      //  first swap, the old profile will be INVALID
      cookieswap_dbg("Profile out is invalid...an ERROR if not the first swap after a crash");
   }

   //Next thing to do is to remove the cookies from the browser and copy
   //  in all the cookies associated with the profile being swapped in.
   //BUT, first ensure we set the ActiveProfileID to INVALID so that if
   //  we were to crash, all our profiles will be intact in persistent
   //  memory and we won't come up thinking that the cookies in the browers
   //  are associated with any profile.
   cookieswap_dbg("Setting to INVALID_PROFILE_ID");
   this._profileContainer.setActiveProfileId(INVALID_PROFILE_ID);
   this.notifyObserversOfSwap(INVALID_PROFILE_ID);

   //Remove all the browser cookies
   cookieswap_dbg("removingAllCookies");
   cookieswap_removeAllCookies();
  
   if (new_profile_id != INVALID_PROFILE_ID)
   {
      //Now swap in the cookies from the profile to the browser
      var new_profile = this._profileContainer.getProfile(new_profile_id);
      var prev_third_party_setting;

      //An unanticipated side effect of disabling ThirdPartyCookies is that
      //  CookieSwap is considered a third-party and so FF does not accept
      //  the cookies we pass to it.  To get around this, we will change the
      //  the user's setting for the short time we are writing to the cookie store.
      //Keep the previous value around so we can switch it back.
      cookieswap_dbg("Enabling third party cookies");
      prev_third_party_setting = this.changeThirdPartyCookieSetting(COOKIE_BEHAVIOR_ACCEPT_ALL);

      cookieswap_dbg("Starting copyToBrowser");
      new_profile.copyToBrowser();
     
      //Switching the setting back the user's original value 
      cookieswap_dbg("Changing third party cookie setting back to " + prev_third_party_setting);
      this.changeThirdPartyCookieSetting(prev_third_party_setting);

      cookieswap_dbg("Setting activeProfileID to " + new_profile_id);
      this._profileContainer.setActiveProfileId(new_profile_id);
      this.notifyObserversOfSwap(new_profile_id);

      cookieswap_dbg("Swap from profile " + old_profile_id + " to " + new_profile_id + " complete");
   }
   else
   {
      alert("[cookieswap] Internal error, profile in is invalid...no cookies swapped in");
   }
   
   cookieswap_dbg("END switchProfile");
  },

  //----changeThirdPartyCookieSetting-----
  //In FF, if the user has selected to not allow ThirdPartyCookies
  //  (via Tools->Options->Privacy->Cookies in FF 3.0) then FF will
  //  not accept the cookies passed to the cookie store from CookieSwap
  //This method allows us to modify that setting temporarly while we
  //  write the cookies to the store (since we aren't the intended
  //  target of this setting).
  //This method changes the ThirdPartyCookieSetting to the value passed
  //  in and passes back the previous value of the setting.
  changeThirdPartyCookieSetting: function(newVal) {
   var cookieBehaviorVal;

   cookieswap_dbg("START changeThirdPartyCookieSetting()");

   var net_pref = Components.classes['@mozilla.org/preferences-service;1']
                 .getService(Components.interfaces.nsIPrefService);
   cookieswap_dbg("got net_pref");

   //Get the branch containing the setting
   net_pref = net_pref.getBranch('network.cookie.');
   cookieswap_dbg("got network.cookie. branch");

   //Get the current value to pass back to the caller
   cookieBehaviorVal= net_pref.getIntPref('cookieBehavior'); 
   cookieswap_dbg("Currently cookieBehavior int is " + cookieBehaviorVal);

   //Setting the behavior to the value passed int.
   net_pref.setIntPref('cookieBehavior', newVal); 
   cookieswap_dbg("set to " + newVal);

   cookieswap_dbg("END changeThirdPartyCookieSetting()");

   return(cookieBehaviorVal);
  },


  //-------------------------------
  //method of nsISupports interface
  //-------------------------------
  QueryInterface: function(aIID)
  {
    if (!aIID.equals(nsIProfile) &&    
        !aIID.equals(nsISupports) &&
        !aIID.equals(nsIPrefBranch) &&
        !aIID.equals(nsIObserver))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

function cookieswap_removeAllCookies()
{
   var cookie_mgr = ffGetCookieManager();
   cookie_mgr.removeAll();
   cookieswap_dbg("All cookies removed");
}


