document.addEventListener("click", (e) => {

  console.log(`Received click for ${e.target.id}`);
  if (e.target.id === "Steve@gmail") {
     console.log(`Handling click for Steve@gmail`);
     var getting = browser.cookies.getAllCookieStores();
     getting.then(logStores);

     notifyBackgroundPage(e.target.id);
  }

  if (e.target.id === "Steve@TF") {
     console.log(`Handling click for Steve@TF`);
     var gettingAllCookies = browser.cookies.getAll({});
    gettingAllCookies.then((cookies) => {
  if (cookies.length > 0) {
      //add an <li> item with the name and value of the cookie to the list
      console.log(`Found ${cookies.length} cookies`);
      var i=0;
      for (let cookie of cookies) {
        if (i < 10)
        {
           console.log(JSON.stringify(cookie));
        }
        i++;
        //console.log(`cookieList: ${cookie.name}, ${cookie.value}`);
      }
    } else {
        console.log("No cookies");
    }  
  });
    notifyBackgroundPage(e.target.id);
  }
});

function logStores(cookieStores) {
  for(store of cookieStores) {
    console.log(`Cookie store: ${store.id}\n Tab IDs: ${store.tabIds}`);
  }
}

function onError(error) {
  console.log(`Error: ${error}`);
}

function addCheckbox(parent, id, label)
{
  //<input type="checkbox" id="coding" name="interest" value="coding" checked>
  //<label for="coding">Coding</label>
  let div = document.createElement("div");

  let input = document.createElement("input");
  input.setAttribute("type", "checkbox");
  input.setAttribute("id", id);
  input.setAttribute("name", id);
  input.setAttribute("value", id);
  input.checked=false;

  let labelElem = document.createElement("label");
  labelElem.setAttribute("for", id);

  let labelTxt = document.createTextNode(label);
  labelElem.appendChild(labelTxt);

  div.appendChild(input);
  div.appendChild(labelElem);
  parent.appendChild(div);
  
  return input;
}

function gotProfiles(val){
  let valStr = JSON.stringify(val);
  console.log(`Got Profiles!  Val: ${valStr}`);
  console.log(`Active profile: ${val.profiles[val.activeProfile]}`)

  if (val.profiles && val.profiles.length>0)
  {
    var profileList = document.getElementById('profile-list');
    var i=0;
    for (let profile of val.profiles) {
      let checked = (i === val.activeProfile);
      console.log(`Adding profile ${profile} (active=${val.activeProfile}) as ${checked}`)
      let item = addCheckbox(profileList, profile, profile);
      item.checked=checked;
      i++;
    }
  }
}

function showCookiesForTab(tabs) {
  //get the first tab object in the array
  let tab = tabs.pop();

  //get all cookies in the domain
  var gettingAllCookies = browser.cookies.getAll({url: tab.url});
  gettingAllCookies.then((cookies) => {

    //set the header of the panel
    var activeTabUrl = document.getElementById('header-title');
    var text = document.createTextNode("Cookies at: "+tab.title);
    var cookieList = document.getElementById('cookie-list');
    activeTabUrl.appendChild(text);

    console.log("CookieSwap: Adding cookies");
    if (cookies.length > 0) {
      //add an <li> item with the name and value of the cookie to the list
      for (let cookie of cookies) {
        addCheckbox(cookieList, cookie.name, cookie.name + ": "+ cookie.value);
      }
    } else {
      let p = document.createElement("p");
      let content = document.createTextNode("No cookies in this tab.");
      let parent = cookieList.parentNode;

      p.appendChild(content);
      parent.appendChild(p);
    }

  //let getting = browser.storage.local.get(["profiles","activeProfile"]);
  //getting.then(gotProfiles, onError);
  });
}

//get active tab to run a callback function.
//it sends to our callback an array of tab objects
function getActiveTab() {
  return browser.tabs.query({currentWindow: true, active: true});
}

//------------ Send message to background-----
function handleResponse(message) {
  console.log(`Message from the background script:  ${message.response}`);
  if(message.profileList){
     gotProfiles(message.profileList);
  }
}

function handleError(error) {
  console.log(`Error: ${error}`);
}

function notifyBackgroundPage(profile) {
  var sending = browser.runtime.sendMessage({
    message: "NewActiveProfile"
  });
  sending.then(handleResponse, handleError);  
}

function getProfiles(profile) {
  var sending = browser.runtime.sendMessage({
    message: "GetProfiles"
  });
  sending.then(handleResponse, handleError);  
}

//--------------------------------------------


console.log("CookieSwap:running");
getActiveTab().then(showCookiesForTab);

getProfiles();

function onProfileClicked(val){
console.log("Profile clicked");
}
