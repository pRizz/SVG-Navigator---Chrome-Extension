// Save this script as `options.js`

// Saves options to localStorage.
function save_options() {
    var select = document.getElementById("clickAndDragBehavior");
    var behavior;
    for (var i = 0; i < select.children.length; i++) {
        var child = select.children[i];
        if (child.checked) {
            behavior = child.value;
            break;
        }
    }
    
    localStorage["clickAndDragBehavior"] = behavior; // saves the string into the localStorage object
    
    // Update status to let user know options were saved.
    var status = document.getElementById("status");
    status.innerHTML = "Options Saved.";
    setTimeout(function() {status.innerHTML = "";}, 1000); // removes "Options Saved." after 1 second
//    chrome.storage.sync.set({'behavior': behavior}, function() {
//                            // Notify that we saved.
//                            console.log('Settings saved ' + behavior);
//                            console.log(chrome.storage.sync.get(null, function(a){}));
//                            });
//    console.log(chrome.storage);
//    console.log(chrome.storage.local);
//    console.log(chrome.storage.sync);
//    console.log(chrome.storage.sync.get(null, function(a){}));
}

// Restores state to saved value from localStorage.
function restore_options() {
    // retrieve clickAndDragBehavior from localStorage
    var clickAndDragBehavior = localStorage["clickAndDragBehavior"];
    if (!clickAndDragBehavior) {
        // make clickAndDragBehavior pan by default
        clickAndDragBehavior = "pan";
        localStorage["clickAndDragBehavior"] = clickAndDragBehavior;
    }
    
    // set the radio button
    var select = document.getElementById("clickAndDragBehavior");
    for (var i = 0; i < select.children.length; i++) {
        var child = select.children[i];
        if (child.value == clickAndDragBehavior) {
            child.checked = "true";
            break;
        }
    }
}

document.addEventListener('DOMContentLoaded', restore_options);
document.querySelector('#save').addEventListener('click', save_options);




