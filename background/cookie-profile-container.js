// *****************************************************************************
// *                    CookieProfileContainer                                 *
// * The CookieProfileContainer handles keeping track of where all the         *
// *   CookieProfiles are stored and determining which profile is active.      *
// * It also enables the user to add/remove profiles.                          *
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

const INVALID_PROFILE_ID = "";
const INVALID_PROFILE_NUM = -1;

const DEFAULT_PROFILES = {
    profiles: [
        "Steve@TF",
        "Steve@gmail"
    ],
    activeProfile: 1
};

//  isPrivate=true is the profile container used when in private browsing
//  isPrivate=false is the profile container used when in normal (non-private) browsing
function CookieProfileContainer(isPrivate) {
    //Define a debug function for the class...change true/false to turn it on/off
    this.classDump = function (s) { true ? cookieswap_dbg("[CookieProfileContainer]" + s) : (s) }

    //This is the way to call the debug function
    this.classDump("START ctor");

    //Start out by assuming we are not in Private Browsing Mode
    this._privBrowsing = isPrivate;

    //Get the profiles and initialize the rest of the object
    browser.storage.local.get(["profiles", "activeProfile"])
             .then(this.init.bind(this), this.onError);

    //This is the way to call the debug function
    this.classDump("END ctor");
}

function gotProfiles(myInstance)

CookieProfileContainer.prototype.getPrivBrowsing = function () {
    return this._privBrowsing;
}

//This method initializes the class.  It's outside the ctor because
//  we can reinit the class when the profile list is changed
CookieProfileContainer.prototype.init = function (profileInfo) {
    this.profileArray = new Array();
    this.activeProfileId = INVALID_PROFILE_ID;

    //If no profiles (or no valid configuration) in the config store
    //  then reinitialize the store
    if (!profileInfo.profiles || profileInfo.profiles.length < 1 ||
        !profileInfo.profiles[profileInfo.activeProfile]) {
        this.classDump("First time CookieSwap has been run...creating default profiles");
        browser.storage.local.set(DEFAULT_PROFILES);
    }

    this.activeProfileId = profileInfo.activeProfile;
    this.classDump(`Profile ${this.activeProfileId} - ${profileInfo.profiles[profileInfo.activeProfile]} is active`);

    for (let profile of profileInfo.profiles) {
        //Create the persistent CookieProfile
        var curr_profile = new CookieProfile(profile, this.activeProfileId);

        //Check to see if the profile is valid
        var curr_profile_name = curr_profile.getProfileName();
        if (curr_profile_name != "") {
            //We have a valid cookie profile file...create the CookieProfile object
            this.profileArray.push({profile:curr_profile,
                                    name: curr_profile_name});

            //If the profile is active, track it
            if (curr_profile.getActiveState() == true) {
                this.classDump(`Profile  ${curr_profile_name} is active`);
                this.activeProfileId = curr_profile_name;
            }
        }
        else {
            //It's not valid, free the profile instance
            curr_profile = null;
        }
    }

    //On some OSes (e.g. Linux), the filesystem doesn't provide the profiles in
    //  alphabetic order.  Reorder the array by name alphabetically.
    this.profileArray.sort(this.sortProfilesAlphabetically);
}

//This method reinitializes the class.  Ideally, this can reinit
//  without needing to go read all the files again, but this
//  is probably the safest way.
//However, we need to not lose the value of the 
//  cookiesCameFromThisSession attribute in the profile class
//  or we will throw away the session cookies on next swap.
CookieProfileContainer.prototype.reinit = function () {
    var j = 0;
    var prof_list_w_session_cookies = new Array();

    this.classDump("Enter reinit()");

    for (var i = 0; i < this.profileArray.length; i++) {
        var curr_profile = this.profileArray[i];

        if (curr_profile.profile.cookiesCameFromThisSession == true) {
            //This profile has valid session cookies.  Store the
            //  profile name for use after init()
            prof_list_w_session_cookies[j] = curr_profile.name;
            j = j + 1;
            this.classDump(curr_profile.name + " has valid session cookies");
        }
    }

    //No go reinit the class
    this.classDump("Calling init()");
    this.init();

    for (var i = 0; i < this.profileArray.length; i++) {
        var curr_profile = this.profileArray[i];

        if (prof_list_w_session_cookies.indexOf(curr_profile.name) != -1) {
            //This profile has valid session cookies.
            //  Store that in the profile
            curr_profile.profile.cookiesCameFromThisSession = true;
            this.classDump("Noting that " + curr_profile.name + " has valid session cookies");
        }
    }
}

//This method is passed to the Array.sort() function as a way
// to compare Profiles in the profileArray so they will be re-sorted
// alphabetically.
//If a.name is earlier than b.name in the alphabet return <0
//If a.name is the same as b.name, return 0
//If a.name is after b.name in the alphabet, return >0
CookieProfileContainer.prototype.sortProfilesAlphabetically = function (a, b) {
    if (a.name.toLowerCase() < b.name.toLowerCase())
        return -1;
    else if (a.name > b.name)
        return 1;
    else
        return 0;
}

//This method returns the number of profiles that exist in this container.
CookieProfileContainer.prototype.getNumOfProfiles = function () {
    return (this.profileArray.length);
}

//This method returns a string that is the name of the profileID passed in.
//  null is returned if the profileID is invalid.
CookieProfileContainer.prototype.getProfileName = function (profileNum) {
    if (profileNum < this.profileArray.length) {
        return (this.profileArray[profileNum].name);
    }
    else {
        this.classDump("Invalid Num (" + profileNum + ") passed in to getProfileName of " + this.profileArray.length);
        return (null);
    }
}

//This method returns the number of the profile whose name was passed in.
//  null is returned if the profileID is invalid.
CookieProfileContainer.prototype.getProfileNum = function (profileId) {
    var prof_num = INVALID_PROFILE_NUM;

    if (profileId != INVALID_PROFILE_ID) {
        //Search the profileArray for the passed in ID
        for (var i = 0; i < this.profileArray.length; i++) {
            if (this.profileArray[i].name == profileId)
                prof_num = i;   //Found the profileName
        }

        //If after searching the array we still didn't find the ID...it's an error
        if (prof_num == INVALID_PROFILE_NUM) {
            this.classDump("ERROR Invalid Name '" + profileId + "' passed in to getProfileNum. Len=" + this.profileArray.length);
        }
    }

    return (prof_num);
}

//This method returns a CookieProfile class object corresponding to the profileID
//  passed in.  If not profile with that profileID exists, null is returned.
CookieProfileContainer.prototype.getProfile = function (profileId) {
    var profile_num = this.getProfileNum(profileId);

    if (profile_num < this.profileArray.length) {
        return (this.profileArray[profile_num].profile);
    }
    else {
        this.classDump("Invalid ID (" + profileId + "which translated to " + profile_num + ") passed in to getProfile of " + this.profileArray.length);
        return (null);
    }
}

//This method adds a CookieProfile object with the passed in name.
//  If success, true is returned and the caller should expect the profile list to have changed.
CookieProfileContainer.prototype.addProfile = function (profileName) {
    this.classDump("addProfile(" + profileName + ")");

    var ret_val = false;

    //First make sure the profile name doesn't already exist
    if (this.getProfileNum(profileName) == INVALID_PROFILE_NUM) {
        //Add to the directory the filename associated with the new profile and create it
        new_profile.append(CookieProfile_getLeafFileName(profileName, false));

        this.classDump("Creating: " + new_profile.path);
        //Now reinit the class to pick up the new profile
        this.reinit();
        ret_val = true;
    }

    return (ret_val);
}

//This method removes the CookieProfile object with the passed in num.
// Retval:  true:  Success, the call should assume the profile list has changed
//          false: Error
CookieProfileContainer.prototype.removeProfile = function (profileNum) {
    this.classDump("removeProfile(" + profileNum + ")");//Still need to perform file operations

    var ret_val = false;
    var active_num = this.getProfileNum(this.activeProfileId);

    //See if the profileNum passed in is valid and that it's not the active profile 
    if (profileNum >= 0 && profileNum < this.profileArray.length && active_num != profileNum) {
        //Delete the profile's file
        this.classDump("Removing the profile");
        this.profileArray[profileNum].profile.remove();

        //Now reinit the class to pick up the change
        this.reinit();
        ret_val = true;
    }
    else {
        this.classDump("Invalid ID or ID of the active profile passed in to removeProfile");
    }

    return (ret_val);
}

//Change the name on the passed in profileNum.
// Retval:  true:  Success, the call should assume the profile list has changed
//          false: Error
CookieProfileContainer.prototype.renameProfile = function (profileNum, newProfileName) {
    this.classDump("renameProfile(" +
        profileNum + "," + newProfileName + ")");
    var ret_val = false;
    var active_num = this.getProfileNum(this.activeProfileId);

    if (profileNum >= 0 && profileNum < this.profileArray.length) {
        //Make the name change
        this.profileArray[profileNum].profile.rename(newProfileName);
        this.profileArray[profileNum].name = newProfileName;

        //Now reinit the class to pick up the change
        this.reinit();
        ret_val = true;
    }
    else {
        this.classDump("Invalid ID passed in to renameProfile");
    }

    return (ret_val);
}

//Copy the passed in profileNum.
// Retval:  true:  Success, the call should assume the profile list has changed
//          false: Error
CookieProfileContainer.prototype.copyProfile = function (profileNum, newProfileName) {
    this.classDump("copyProfile(" +
        profileNum + "," + newProfileName + ")");
    var ret_val = false;
    var active_num = this.getProfileNum(this.activeProfileId);

    if (profileNum >= 0 && profileNum < this.profileArray.length) {
        //First make sure the new profile name doesn't already exist
        if (this.getProfileNum(newProfileName) == INVALID_PROFILE_NUM) {
            //Make the copy
            this.profileArray[profileNum].profile.copy(newProfileName);

            //Now reinit the class to pick up the new profile
            this.reinit();
            ret_val = true;
        }
    }
    else {
        this.classDump("Invalid ID passed in to copyProfile");
    }

    return (ret_val);
}

//Returns the profileID of the active profile
CookieProfileContainer.prototype.getActiveProfileId = function () {
    return (this.activeProfileId);
}

//Changes the active profile to the profileID pased in.  The active profileID
//  is returned.  If it doesn't match the profileId passed in, then it was
//  not accepted as a valid profile to make active.
CookieProfileContainer.prototype.setActiveProfileId = function (new_profile_id) {
    this.classDump("START setActiveProfileId( " + new_profile_id + ")");

    var old_profile_id = this.activeProfileId;
    var old_profile_num = this.getProfileNum(old_profile_id);
    this.classDump("Old profile '" + old_profile_id + "' is num " + old_profile_num);

    var new_profile_num = this.getProfileNum(new_profile_id);
    this.classDump("New profile '" + new_profile_id + "' is num " + new_profile_num);

    //If the currently active profile is valid, rename that profile's filename to indicate
    //  that is no longer the active profile
    if ((old_profile_id != INVALID_PROFILE_ID) && (old_profile_num < this.profileArray.length)) {
        //Set the old profile to no longer be active
        this.profileArray[old_profile_num].profile.setActiveState(false);
    }

    //If the new profileID is valid, rename that profile's file to indicate that it
    //  is the active profile
    if ((new_profile_num != INVALID_PROFILE_NUM) && (new_profile_num < this.profileArray.length)) {
        this.profileArray[new_profile_num].profile.setActiveState(true);
    }
    else {
        //The profile passed in is not valid.
        //This is an error condition unless we are swapping to the INVALID_PROFILE_ID
        if (new_profile_id != INVALID_PROFILE_ID) {
            this.classDump("ERROR Invalid ID '" + new_profile_id + "' passed in to setActiveProfileId");
            new_profile_id = INVALID_PROFILE_ID;  //Non-valid ID passed in, make it INVALID
        }
    }

    this.activeProfileId = new_profile_id;
    this.classDump("END setActiveProfileId( " + new_profile_id + ")");

    return (this.activeProfileId);
}

CookieProfileContainer.prototype.onError = function (error) {
    this.classDump(`Error getting local storage data: ${error}`);
}
