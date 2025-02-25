import { SVGNavigatorDefaultSettings } from "./js/defaultSettings";

window.addEvent("domready", function () {
    // Option 1: Use the manifest:
    new FancySettings.initWithManifest(function (settings) {
        settings.manifest.resetBehaviors.addEvent("action", function () {
			// reset the settings to defaults
			settings.manifest.clickAndDragBehavior.set(SVGNavigatorDefaultSettings.clickAndDragBehavior);
			settings.manifest.scrollSensitivity.set(SVGNavigatorDefaultSettings.scrollSensitivity);
			settings.manifest.invertScroll.set(SVGNavigatorDefaultSettings.invertScroll);
        });
        settings.manifest.resetBackgroundColor.addEvent("action", function () {
            // reset the background color to default
            settings.manifest.svgBackgroundColor.set(SVGNavigatorDefaultSettings.svgBackgroundColor);
        });

        // Add listener for background color changes
        settings.manifest.svgBackgroundColor.addEvent("action", function (color) {
            // Send message to all tabs
            chrome.tabs.query({}, function(tabs) {
                tabs.forEach(function(tab) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'backgroundColorChanged',
                        color: color
                    });
                });
            });
        });
    });
    
    // Option 2: Do everything manually:
    /*
    var settings = new FancySettings("My Extension", "icon.png");
    
    var username = settings.create({
        "tab": i18n.get("information"),
        "group": i18n.get("login"),
        "name": "username",
        "type": "text",
        "label": i18n.get("username"),
        "text": i18n.get("x-characters")
    });
    
    var password = settings.create({
        "tab": i18n.get("information"),
        "group": i18n.get("login"),
        "name": "password",
        "type": "text",
        "label": i18n.get("password"),
        "text": i18n.get("x-characters-pw"),
        "masked": true
    });
    
    var myDescription = settings.create({
        "tab": i18n.get("information"),
        "group": i18n.get("login"),
        "name": "myDescription",
        "type": "description",
        "text": i18n.get("description")
    });
    
    var myButton = settings.create({
        "tab": "Information",
        "group": "Logout",
        "name": "myButton",
        "type": "button",
        "label": "Disconnect:",
        "text": "Logout"
    });
    
    // ...
    
    myButton.addEvent("action", function () {
        alert("You clicked me!");
    });
    
    settings.align([
        username,
        password
    ]);
    */
});
