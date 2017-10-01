function onError(error) {
  console.log(`Error: ${error}`);
}

function gotIt(val){
  let valStr = JSON.stringify(val);
  console.log(`Got It!  Val: ${valStr}`);
  console.log(`Active profile: ${val.profiles[val.activeProfile]}`)

}

function onSuccess() {
  console.log(`Set Success`);
  let getting = browser.storage.local.get(["profiles","activeProfile"]);
  getting.then(gotIt, onError);
}

function storeProfiles() {
  let profiles = {
    profiles: [
      "Steve@TF",
      "Steve@gmail"
    ],
    activeProfile: 1
  };
  let setting = browser.storage.local.set(profiles);
  console.log(`Stored:  Profiles: ${profiles}`);
  setting.then(onSuccess, onError);
  
  return;
}

/*
Log the storage area that changed,
then for each item changed,
log its old value and its new value.
*/
function logStorageChange(changes, area) {
  console.log("Change in storage area: " + area);
 
  var changedItems = Object.keys(changes);
 
  for (var item of changedItems) {
    console.log(item + " has changed:");
    console.log("Old value: ");
    console.log(changes[item].oldValue);
    console.log("New value: ");
    console.log(changes[item].newValue);
  }
}

//--------- Receive messages-------
function handleMessage(request, sender, sendResponse) {
  
  if(request.message && request.message == "NewActiveProfile"){
    console.log("New active profile message from the content script: " +
    request.newProfile);
  }

  if(request.message && request.message == "GetProfiles"){
    console.log("Request for profile list");
    var profileList = profileMgr.getProfileList();
    sendResponse({response: "Response from background script",
                  profileList});
  }
}

browser.runtime.onMessage.addListener(handleMessage);

//---------------------------------


browser.storage.onChanged.addListener(logStorageChange);
console.log("CookieSwapBkg:running");
//storeProfiles();

//Now get the CookieProfileContainer singleton which initializes it
//var _profileContainer = new CookieProfileContainer(isPrivate);

//Show the currently active profile as active on the UI
//var _currentProfile = this._profileContainer.getActiveProfileId();
//console.log(`Current profile ID is {$_currentProfile}`)

//Initialize the Cookieswap Logger
console.log("loggerInit()");
cookieswap_loggerInit(); 
   
//Initialize the CookieManagerModule
console.log("initCookieManagerModule()");
initCookieManagerModule();

console.log("getCookieSwapProfileMgrModule()");
var profileMgr = getCookieSwapProfileMgrModule(false);
console.log("profileMgr profileList is " + JSON.stringify(profileMgr.getProfileList()));