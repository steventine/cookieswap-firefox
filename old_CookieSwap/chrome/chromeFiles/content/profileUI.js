// *****************************************************************************
// *                           ProfileUI Class                                 *
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
// *  SteveTine  15Jan2005  12751   Stop-gap solution to multiple window prob  *
// *  SteveTine  31Jan2007  Trac4   Exchange CookieSwap term in statusbar with icon *
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

//Static instance attribute
var gProfileUI_instance = null;

//-------------ProfileUI class definition--------------
//The ProfileUI class handles displaying all the Profile information to the User Interface.  
//  This class enables you to change the way the profiles are displayed or presented to the 
//  user without affecting the backend.  This class will call the registered function when 
//  the user selects a new profile
//This class is a singleton, so there is only one in existance.  Use the
//  ProfileUI_getInstance() function to get the instance of the class.
function ProfileUI()
{
   //Define a debug function for the class...change true/false to turn it on/off
   this.classDump=function(s){true ? cookieswap_dbg("[ProfileUI]" + s) : (s)}

   //This is the way to call the debug function
   this.classDump("START ctor");

   //---Define some attributes

   //This is the item that users see in the status bar...its name should include the
   //  active profile
   this.cookieStatusBar = document.getElementById('cookieswap-label');
   
   //This is the item that users see in the toolbar...its name should include the
   //  active profile
   this.cookieToolBar = document.getElementById('cookieswap-toolbar-button');

   //This is the flag that identifies if the active profile should be displayed in the
   //  the toolbar
   this.displayProfileInToolBar = true;

   //This is the item that users see in the toolbar...its name should include the
   //  active profile
   this.cookieProfNameInTooltip = document.getElementById('cookieswap-tooltip-active-profile');

   //Get the cookie-element-list which is the popup menu in the status bar
   this.cookieElemList = document.getElementById('cookie-element-list');

   //Get the seperator between the proifle names and the functions.  This separator
   //  is the divider between the profile names and the options.  So, insert all the
   //  profile before this separator.
   this.profileSeparator = document.getElementById("cookie-profile-list-separator");

   //This attribute holds the pointer to the function that the caller of this class
   //  wants to be called when the user selects a profile on the UI.
   //Default it to null until a user registers their callback with the class.
   this.profileSelectedCallback = null;

   //When going to private browsing, need to keep the original label so it can
   //  be restored
   this.statusBarValuePriorToDisable = "";

   //Create an observer to watch for profileUI preference changes
   //  (the observer is called at startup for each pref as well)
   this.profileUiPrefChangedObserver = new 
            cookieswap_prefListener("extensions.cookieswap.options.profileUI.", 
                                    profileUiPrefChanged );

   this.classDump("END ctor");
}

//---------Static Methods-------------

//Publically available method to get the singleton instance of the ProfileUI class
function profileUI_getInstance()
{
   if (gProfileUI_instance == null)
   {
      //If this is the first time this method is being called, create the singleton
      //  instance of the class and return it.
      gProfileUI_instance = new ProfileUI();
      cookieswap_dbg("Created singleton instance of ProfileUI\n");

      //Register the Pref observer (must be done after ctor complete because
      //   the observer needs the singleton instance.)
      gProfileUI_instance.profileUiPrefChangedObserver.register();

      //Register an observer to know when the toolbar has been customized
      //  (i.e. someone has added or removed a toolbar icon...like the CookieSwap icon)
      //  Another event that could be useful is "beforecustomization" (opens toolbar
      //  customization window) and "aftercustomization" (toolbar customization
      //  window closed).
      window.addEventListener("customizationchange", toolbarCustomizationChanged, false);
   }

   return gProfileUI_instance;
}

//Publically available method to destroy the singleton instance of the ProfileUI class
function profileUI_destroyInstance()
{
   if (gProfileUI_instance != null)
   {
      //Unregister the pref observer
      gProfileUI_instance.profileUiPrefChangedObserver.unregister();
      gProfileUI_instance = null;
      
      //Unregister the toolbar customization event listener
      window.removeEventListener("customizationchange", toolbarCustomizationChanged, false);

      cookieswap_dbg("Destoryed singleton instance of ProfileUI\n");
   }
}

//This static method is called by the browser when a user selects a profile from the menu
function profileUI_profileSelected(menuitem)
{
   var  profileIdSelected = menuitem.getAttribute("label");
   var  profileUi = profileUI_getInstance();

   profileUi.classDump("New profile selected: " + menuitem.label + "(" + profileIdSelected + ")");

   if (profileUi.profileSelectedCallback != null)
   {
      //A callback is registred for this event...call it
      profileUi.classDump("Invoking callback");
      profileUi.profileSelectedCallback(profileIdSelected);
   }
   else
   {
      profileUi.classDump("new profile selected but no callback exists");
   }
}

//Called whenever a profileUI specific pref has changed
//  (and once at startup with the initial value)
function profileUiPrefChanged(branch, name)
{
   var  profileUi = profileUI_getInstance();
   profileUi.classDump("profileUiPrefChanged " + name);

   switch (name) 
   {
       case "DisplayProfileNameInToolbar":
           // extensions.cookieswap.DisplayProfileInToolbar was changed
           profileUi.displayProfileInToolBar = branch.getBoolPref(name);
           cookieswap_dbg("DisplayProfileInToolbar pref changed to " + profileUi.displayProfileInToolBar);

	   //Now set the Toolbar label based on the new pref
           profileUi.setToolbarLabel(null);
           break;
   }
}

//Called whenever the toolbar has been customized
//  (Like the cookieswap icon was added to the toolbar)
function toolbarCustomizationChanged(toolbox)
{
   var  profileUi = profileUI_getInstance();

   //It's possible that the CookieSwap toolbar item has been created or removed
   //  so first update the local pointer to the toobar item
   profileUi.cookieToolBar = document.getElementById('cookieswap-toolbar-button');

   //Now set the Toolbar label correctly
   profileUi.setToolbarLabel(null);
}

//---------Public Methods-------------

//Allow caller to register a callback that is called when a user selects a
// profile on the UI.
ProfileUI.prototype.registerProfileSelectedCallback = function(callback)
{
   this.profileSelectedCallback = callback;
   this.classDump("Caller registered callback");
}

//This method will add a profile to the UI list.
//  profileName  - descriptive string of the profile
//  profileID    - ID associated with the profile
ProfileUI.prototype.addProfileToList = function(profileName, profileID)
{
   var  new_profile;

   //We'll create a new menuitem for the profile
   new_profile = document.createElement("menuitem");
   new_profile.setAttribute("id", "profile:" + profileName);
   new_profile.setAttribute("label", profileName);
   new_profile.setAttribute("tooltipText", "");

   //Use the same name for items of the same radio group
   new_profile.setAttribute("type", "radio");
   new_profile.setAttribute("name", "cookie-profile-list");

   //Setting autocheck to false means we will keep track of indicating the
   //  correct item is checked/selected
   new_profile.setAttribute("autocheck", false);
   new_profile.setAttribute("checked", false);
   new_profile.setAttribute("class", "cookie-profile");
   new_profile.setAttribute("profileId", profileID);
   new_profile.setAttribute("oncommand", "profileUI_profileSelected(this);");

   
   this.classDump("Inserting '" + profileName + "'");

   //Insert the new profile just before the separator so that this profile
   //  would be after all the existing profile
   this.cookieElemList.insertBefore(new_profile, this.profileSeparator);
}   

//This method will remove the selected profile from the UI list
ProfileUI.prototype.removeProfileFromList = function(profileID)
{
//---[TODO] NOT IMPLEMENTED YET---
   this.classDump("UNIMPLEMENTED FUNCTION CALLED...removeProfileFromList");
}

//This method will remove the selected profile from the UI list
ProfileUI.prototype.removeAllProfilesFromList = function()
{
   this.classDump("removeAllProfilesFromList");

   //Get all the cookie-profile items from the menu
   menu_items = this.cookieElemList.getElementsByAttribute("class", "cookie-profile");
   
   this.classDump("Finished searching for elementsByAttribute");

   if (menu_items != null)
   {
      //We found the menu item, but it is possible that item 0 is null
      this.classDump("Found " + menu_items.length + " menu items");

      //Walk the list and remove the menu items
      for(var i=menu_items.length-1; i>=0; i--)
      {
         this.cookieElemList.removeChild(menu_items[i]);
      }
   }
   else
   {
      this.classDump("No menu items found to remove");
   }

}

//This method will show the selected profile as active in the UI list
ProfileUI.prototype.showProfileAsActive = function(profileID)
{
   var profile_menu;

   this.classDump("Setting " + profileID + " as active...first uncheck all");

   this.uncheckAll();

   //We need to get the profile_menu item out of the menu so we can get
   //  the name of the profile and set it to checked.
   profile_menu = this.getMenuItem(profileID);
   
   this.classDump("Finished getMenuItem");

   if(profile_menu != null)
   {
      //Set the checkbox on the profile and put the profile name in the StatusBar
      profile_menu.setAttribute("checked", true);
      this.cookieStatusBar.setAttribute("value", profile_menu.getAttribute("label"));
      this.cookieProfNameInTooltip.setAttribute("value", profile_menu.getAttribute("label"));
      this.setToolbarLabel(profile_menu.getAttribute("label"));

      this.classDump("Handled active profile");
   }
   else
   {
      //TODO...define INVALID_PROFILE_ID in this scope
      //Passing in the INVALID_PROFILE_ID is normal (to deselect any profile).  If we
      //  ended up here for another reason it is an unexpected error
      if (profileID != INVALID_PROFILE_ID)
      {
         this.classDump("ERROR-UNABLE TO FIND MENUTIEM FOR '" + profileID + "'");
      }

      //[TODO]Should uncheck the current profile and change the statusbar to just CookieSwap:
      //  Probably should keep track of currActive and deselect it first then try to
      //  select the new profile
   }
}

//This method will set the Toolbar label correctly depending on user preference
//  If the profileLabel is null this method will go find the current profile to display
ProfileUI.prototype.setToolbarLabel= function(profileLabel)
{
      //If the toolbar wasn't installed when the ProfileUI ctor ran, check to see
      //  if it has been installed since.
      //  Ticket #82  tracks the need for a real way to know immediately when the 
      //  icon has been installed.
      if (this.cookieToolBar == null)
      {
         this.cookieToolBar = document.getElementById('cookieswap-toolbar-button');
      }

      //Only put the profile in the toolbar if the pref says to do so
      //  and the user has put the CookieSwap toolbar icon in the toolbar
      if (this.cookieToolBar != null)
      {
         if (this.displayProfileInToolBar == true)
         {
            if (profileLabel == null)
            {
                //If not passed in, get the current profile label from the tooltip
                profileLabel = this.cookieProfNameInTooltip.getAttribute("value");
            }

            this.cookieToolBar.setAttribute("label", profileLabel);
         }
         else
         {
            this.cookieToolBar.setAttribute("label", "");
         }
      }
}

//This private method will return the menu item matching the profileID passed in.
//  If no menu item is found, null is returned
ProfileUI.prototype.getMenuItem = function(profileID)
{
   var  menu_items;
   var  profile_item;
      
   this.classDump("Searching for elementByAttribute");

   menu_items = this.cookieElemList.getElementsByAttribute("label", profileID);
   
   this.classDump("Finished searching for elementByAttribute");

   if (menu_items != null)
   {
      //We found the menu item, but it is possible that item 0 is null
      this.classDump("Found a menu mathing profileID");
      profile_item = menu_items[0];
   }
   else
   {
      this.classDump("No menu found matching profileID");
      profile_item = null;
   }

   return profile_item
}

//Uncheck all profiles in the menulist
ProfileUI.prototype.uncheckAll = function()
{
   var  checked_items;
      
   this.classDump("Unchecking all profiles");

   checked_items = this.cookieElemList.getElementsByAttribute("checked", true);
   
   this.classDump("Finished searching for elementByAttribute");

   if (checked_items != null)
   {
      for(var i=0; i<checked_items.length; i++)
      {
         if (checked_items[i] != null)
         {
            this.classDump("Unchecking " + checked_items[i].getAttribute("label"));
            checked_items[i].setAttribute("checked", false);
         }
         else
         {
            this.classDump("Item " + i + " was unexpectedly null...");
         }
      }
   }
}

//This method will have the UI indicate that CookieSwap is not active in
// this browser window
ProfileUI.prototype.showBrowserAsInactive = function()
{
      this.cookieStatusBar.setAttribute("value", "");
}

ProfileUI.prototype.enterPrivateBrowsing = function()
{
   //Ticket #88 describes why we need to disable CS in PB mode for now
   
   //Change icon
   //TODO: Need to change the Toolbar icon as well (ideally done via a theme change)
   document.getElementById("cookieswap-status-bar-icon").setAttribute("src", 
                 "chrome://cookieswap/skin/CookieSwap_private_tinyicon.png");
   document.getElementById("cookieswap-toolbar-button").setAttribute("image", 
                  "chrome://cookieswap/skin/CookieSwap_private_tinyicon.png");
   
   var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                        .getService(Components.interfaces.nsIXULAppInfo);
   var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                               .getService(Components.interfaces.nsIVersionComparator);
   if (versionChecker.compare(appInfo.version, "19") >= 0) {
       // running under Firefox 19 or later
       //Ticket #88 describes why we need to disable CS in PB mode starting in FF 19
       this.setDisableStateOfAllProfiles(true);

       //Update the instructions tooltip
       var instructionTooltip = document.getElementById('cookieswap-tooltip1');
       if (instructionTooltip != null) {
           instructionTooltip.setAttribute("value", "CookieSwap disabled in Private Browsing mode due to Firefox limitation");
       }

       //Use the disabled CookieSwap icon
       document.getElementById("cookieswap-status-bar-icon").setAttribute("src",
              "chrome://cookieswap/skin/CookieSwap_disabled_tinyicon.png");
       document.getElementById("cookieswap-toolbar-button").setAttribute("image",
                      "chrome://cookieswap/skin/CookieSwap_disabled_tinyicon.png");

   }
   else
   {
       //Use the private browsing icon
       document.getElementById("cookieswap-status-bar-icon").setAttribute("src",
              "chrome://cookieswap/skin/CookieSwap_private_tinyicon.png");
       document.getElementById("cookieswap-toolbar-button").setAttribute("image",
                      "chrome://cookieswap/skin/CookieSwap_private_tinyicon.png");
   }
}
 
ProfileUI.prototype.exitPrivateBrowsing = function()
{
   //Change icon
   //TODO: Need to change the Toolbar icon as well (ideally done via a theme change)
   document.getElementById("cookieswap-status-bar-icon").setAttribute("src", 
                  "chrome://cookieswap/skin/CookieSwap_tinyicon.png");
   document.getElementById("cookieswap-toolbar-button").setAttribute("image", 
                  "chrome://cookieswap/skin/CookieSwap_tinyicon.png");

   var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
                        .getService(Components.interfaces.nsIXULAppInfo);
   var versionChecker = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
                               .getService(Components.interfaces.nsIVersionComparator);
   if(versionChecker.compare(appInfo.version, "19") >= 0) 
   {
      // running under Firefox 19 or later
      //Ticket #88 describes why we need to disable CS in PB mode starting in FF 19
	  this.setDisableStateOfAllProfiles(false);

      //Update the instructions tooltip
      var instructionTooltip = document.getElementById('cookieswap-tooltip1');
      if (instructionTooltip != null)
      {
         instructionTooltip.setAttribute("value", "Click to select a new profile");
      }

   }

}

//This method will enable/disable all the profiles in the UI list
//  disabledState=false will enable all the profiles
//  disabledState=true will disable all the profiles
ProfileUI.prototype.setDisableStateOfAllProfiles = function(disabledState)
{
   this.classDump("setDisableStateOfAllProfiles(" + disabledState + ")");

   //Get all the cookie-profile items from the menu
   menu_items = this.cookieElemList.getElementsByAttribute("class", "cookie-profile");
   
   this.classDump("Finished searching for elementsByAttribute");

   if (menu_items != null)
   {
      //We found the menu item, but it is possible that item 0 is null
      this.classDump("Found " + menu_items.length + " menu items");

      //Walk the list and change enabled state
      for(var i=menu_items.length-1; i>=0; i--)
      {
         menu_items[i].setAttribute("disabled",disabledState);
		 if (disabledState)
		 {
		    menu_items[i].setAttribute("tooltiptext", "Disabled during Private Browsing"); 
	     }
		 else
		 {
		    menu_items[i].setAttribute("tooltiptext", ""); 
	     }
		 
      }
   }
   else
   {
      this.classDump("No menu items found");
   }

}
