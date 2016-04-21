# cookieswap-firefox
CookieSwap Firefox Extension
============================
Repository for the [CookieSwap] (https://addons.mozilla.org/en-US/firefox/addon/cookieswap/) Firefox extension/add-on


Building
--------
```
./build.sh    (which uses 'zip') or
```
```
./build_7z.sh   (which uses 7zip)
```

Installation
------------
Only signed extensions can be added to Firefox now (see [this] (https://support.mozilla.org/en-US/kb/add-on-signing-in-firefox?as=u&utm_source=inproduct) for details)

To temporarily disable signature validation:
`about:config` and then set `xpinstall.signatures.required` to `false`
