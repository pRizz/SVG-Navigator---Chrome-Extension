/*
 SVG Navigator
 options.js
 created 2013-07-10 by Peter Ryszkiewicz
 code taken from https://developer.chrome.com/extensions/options.html
 */

// Save this script as `options.js`

// TODO make everything use jQuery



// called on document ready
$(function(){
  // cache frequenty used elements
  var $save = $("#save"),
  $reset = $("#reset");
  $save.button({label:"Save"}).click(save_options);
  $reset.button();
  
  // Saves options to localStorage.
  function save_options() {
    var select = document.getElementById("clickAndDragBehavior");
    var behavior;
    // cycle through clickAndDragBehavior form element and save the string value of the selected behavior
    for (var i = 0; i < select.children.length; i++) {
        var child = select.children[i];
        if (child.checked) {
            behavior = child.value;
            break;
        }
    }
  
    localStorage["clickAndDragBehavior"] = behavior; // saves the string into the localStorage object
  
    // Update status to let user know options were saved.
    //  var status = document.getElementById("save");
    //  status.innerHTML = "Options Saved.";
    //  status.disabled = true;
    $save.button({label:"Options Saved", disabled: true});
    setTimeout(function() {
             $save.button({label:"Save", disabled: false});
    },
    1000); // removes "Options Saved." after 1 second

    console.log("Options saved!");
  }
  
  // Restores state to saved value from localStorage.
  (function restore_options() {
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
   })();
  
  }); // end of $()

