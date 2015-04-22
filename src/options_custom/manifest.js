// SAMPLE
this.manifest = {
    "name": "SVG Navigator",
    "icon": "icon_sans_38.png",
    "settings": [
		{
			"tab": i18n.get("Settings"),
			"group": i18n.get("Behaviors"),
			"name": "clickAndDragBehavior",
            "type": "popupButton",
            "label": "Click and drag: ",
            "options": {
                "values": [
                    {
                        "value": "pan",
                        "text": "Pan"
                    },
                    {
                        "value": "zoomBox",
                        "text": "Zoom Box"
                    }
                ]
            }
			
		},
		{
			"tab": i18n.get("Settings"),
			"group": i18n.get("Behaviors"),
			"name": "scrollSensitivity",
            "type": "slider",
            "label": "Scroll sensitivity:",
            "max": 10,
            "min": 0.01,
            "step": 0.01,
            "display": true,
            "displayModifier": function (value) {
                return value;
            }
		},
		{
			"tab": i18n.get("Settings"),
			"group": i18n.get("Behaviors"),
			"name": "invertScroll",
            "type": "checkbox",
            "label": "Invert scroll"
		},
		{
			"tab": i18n.get("Settings"),
			"group": i18n.get("Behaviors"),
			"name": "resetBehaviors",
            "type": "button",
            "text": "Reset Behaviors to Defaults"
		},
		{
			"tab": i18n.get("Settings"),
			"group": i18n.get("Toolbar"),
			"name": "toolbarAutoHide",
            "type": "checkbox",
            "label": "Auto hide"
		},
        {
            "tab": i18n.get("Settings"),
            "group": i18n.get("Toolbar"),
            "name": "toolbarEnabled",
            "type": "checkbox",
            "label": "Enabled"
        },
        {
            "tab": i18n.get("Settings"),
            "group": i18n.get("Debug"),
            "name": "showDebugInfo",
            "type": "checkbox",
            "label": "Show Debugging Info",
        },
        {
            "tab": i18n.get("information"),
            "group": "Description",
            "name": "Description",
            "type": "description",
            "text": i18n.get("Description")
        },
        {
            "tab": i18n.get("information"),
            "group": "Usage",
            "name": "Usage",
            "type": "description",
            "text": i18n.get("Usage"),	
        },
        {
            "tab": i18n.get("information"),
            "group": "Try Testing out these SVGs",
            "name": "Try Testing out these SVGs",
            "type": "description",
            "text": i18n.get("Try Testing Out These SVGs")
        },
        {
            "tab": i18n.get("information"),
            "group": "Useful Links",
            "name": "Useful Links",
            "type": "description",
            "text": i18n.get("Useful Links")
        },
        {
            "tab": i18n.get("information"),
            "group": "Acknowledgements",
            "name": "Acknowledgements",
            "type": "description",
            "text": i18n.get("Acknowledgements")
        }
    ],
    "alignment": [
    ]
};
