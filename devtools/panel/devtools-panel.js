function onError(error) {
  console.log(`Error: ${error}`);
}

function onSuccess() {
  console.log(`Set Success`);
}

function setDeepDebug(newVal) {
  let deepDebugEnabled = newVal;
  let setting = browser.storage.local.set(deepDebugEnabled);
  console.log(`Stored:  deepDebugEnabled {$deepDebugEnabled}`);
  setting.then(onSuccess, onError);
  
  return;
}

document.getElementById("button_dumpInfo").addEventListener("click", () => {
  console.log("--------CookieSwap Info Dump START --------");

  console.log("--------CookieSwap Info Dump END --------");
});

document.getElementById("gCsDbgErrConsoleCheck").addEventListener("click", (e) => {
  if (e.target.checked === true){
    console.log("Enabling cookieswap deep debug");
    setDeepDebug(true);
     
  }
  else if (e.target.checked === false){
    console.log("Disabling cookieswap deep debug");
    setDeepDebug(false); 
  }


  console.log("--------CookieSwap Info Dump END --------");
});


