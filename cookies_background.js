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

console.log("CookieSwapBkg:running");
storeProfiles();
