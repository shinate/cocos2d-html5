/****************************************************************************
 Copyright (c) 2013-2014 Chukong Technologies Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

(function(load, baseParser){

    var DEBUG = false;

    var Parser = baseParser.extend({

        parse: function(file, json, path){
            var resourcePath;
            if(path !== undefined)
                resourcePath = path;
            else
                resourcePath = this._dirname(file);
            this.pretreatment(json, resourcePath, file);
            var node = this.parseNode(this.getNodeJson(json), resourcePath);
            this.deferred(json, resourcePath, node, file);
            return node;
        },

        getNodeJson: function(json){
            return json["Content"]["Content"]["ObjectData"];
        },

        getClass: function(json){
            return json["ctype"];
        }

    });
    var parser = new Parser();


    var getParam = function(value, dValue){
        if(value === undefined)
            return dValue;
        else
            return value;
    };

    //////////
    // NODE //
    //////////

    parser.generalAttributes = function(node, json){
        if(json["Name"] != null)
            node.setName(json["Name"]);

        var position = json["Position"];
        if(position != null && (position["X"] != null || position["Y"] != null))
            node.setPosition(cc.p(position["X"]||0, position["Y"]||0));

        var scale = json["Scale"];
        if(scale != null){
            if(scale["ScaleX"] != null)
                node.setScaleX(scale["ScaleX"]);
            if(scale["ScaleY"] != null)
                node.setScaleY(scale["ScaleY"]);
        }

        var rotationSkewX = json["RotationSkewX"];
        if (rotationSkewX != null)
            node.setRotationX(rotationSkewX);

        var rotationSkewY = json["RotationSkewY"];
        if (json["RotationSkewY"] != null)
            node.setRotationY(rotationSkewY);


        var anchor = json["AnchorPoint"];
        if(anchor != null){
            if(anchor["ScaleX"] == null)
                anchor["ScaleX"] = 0;
            if(anchor["ScaleY"] == null)
                anchor["ScaleY"] = 0;
            if(anchor["ScaleX"] != 0.5 || anchor["ScaleY"] != 0.5)
                node.setAnchorPoint(cc.p(anchor["ScaleX"], anchor["ScaleY"]));
        }

        if (json["ZOrder"] != null)
            node.setLocalZOrder(json["ZOrder"]);

        var visible = getParam(json["VisibleForFrame"], true);
        node.setVisible(visible);

        setContentSize(node, json["Size"]);

        if (json["Alpha"] != null)
            node.setOpacity(json["Alpha"]);

        node.setTag(json["Tag"] || 0);

        var actionTag = json["ActionTag"] || 0;
        var extensionData = new ccs.ObjectExtensionData();
        var customProperty = json["UserData"];
        if(customProperty !== undefined)
            extensionData.setCustomProperty(customProperty);
        extensionData.setActionTag(actionTag);
        node.setUserObject(extensionData);

        node.setCascadeColorEnabled(true);
        node.setCascadeOpacityEnabled(true);

        setLayoutComponent(node, json);
    };

    parser.parseChild = function(node, children, resourcePath){
        if(!node || !children) return;
        for (var i = 0; i < children.length; i++) {
            var child = this.parseNode(children[i], resourcePath);
            if(child){
                if(node instanceof ccui.PageView){
                    if(child instanceof ccui.Layout)
                        node.addPage(child);
                } else {
                    if(node instanceof ccui.ListView){
                        if(child instanceof ccui.Widget)
                            node.pushBackCustomItem(child);
                    } else {
                        if(!(node instanceof ccui.Layout) && child instanceof ccui.Widget) {
                            if(child.getPositionType() === ccui.Widget.POSITION_PERCENT) {
                                var position = child.getPositionPercent();
                                var anchor = node.getAnchorPoint();
                                child.setPositionPercent(cc.p(position.x + anchor.x, position.y + anchor.y));
                            }
                        }
                        node.addChild(child);
                    }
                }
            }
        }
    };

    /**
     * SingleNode
     * @param json
     * @returns {cc.Node}
     */
    parser.initSingleNode = function(json){
        var node = new cc.Node();

        this.generalAttributes(node, json);

        return node;
    };

    /**
     * Sprite
     * @param json
     * @param resourcePath
     * @returns {cc.Sprite}
     */
    parser.initSprite = function(json, resourcePath){
        var node =  new cc.Sprite();

        loadTexture(json["FileData"], resourcePath, function(path, type){
            if(type === 0)
                node.setTexture(path);
            else if(type === 1){
                var spriteFrame = cc.spriteFrameCache.getSpriteFrame(path);
                if(spriteFrame)
                    node.setSpriteFrame(spriteFrame);
            }
        });

        var blendData = json["BlendFunc"];
        if(json["BlendFunc"]) {
            var blendFunc = cc.BlendFunc.ALPHA_PREMULTIPLIED;
            if (blendData["Src"] !== undefined)
                blendFunc.src = blendData["Src"];
            if (blendData["Dst"] !== undefined)
                blendFunc.dst = blendData["Dst"];
            node.setBlendFunc(blendFunc);
        }

        if(json["FlipX"])
            node.setFlippedX(true);
        if(json["FlipY"])
            node.setFlippedY(true);

        this.generalAttributes(node, json);
        var color = json["CColor"];
        if(color != null)
            node.setColor(getColor(color));

        return node;
    };

    /**
     * Particle
     * @param json
     * @param resourcePath
     * @returns {*}
     */
    parser.initParticle = function(json, resourcePath){
        var node,
            self = this;
        loadTexture(json["FileData"], resourcePath, function(path, type){
            if(!cc.loader.getRes(path))
                cc.log("%s need to be preloaded", path);
            node = new cc.ParticleSystem(path);
            self.generalAttributes(node, json);
            node.setPositionType(cc.ParticleSystem.TYPE_GROUPED);
            !cc.sys.isNative && node.setDrawMode(cc.ParticleSystem.TEXTURE_MODE);

            var blendData = json["BlendFunc"];
            if(json["BlendFunc"]){
                var blendFunc = cc.BlendFunc.ALPHA_PREMULTIPLIED;
                if(blendData["Src"] !== undefined)
                    blendFunc.src = blendData["Src"];
                if(blendData["Dst"] !== undefined)
                    blendFunc.dst = blendData["Dst"];
                node.setBlendFunc(blendFunc);
            }
        });
        return node;
    };


    ////////////
    // WIDGET //
    ////////////

    parser.widgetAttributes = function (widget, json, enableContent) {
        widget.setCascadeColorEnabled(true);
        widget.setCascadeOpacityEnabled(true);

        widget.setUnifySizeEnabled(false);
        //widget.setLayoutComponentEnabled(true);
        widget.ignoreContentAdaptWithSize(false);
        !enableContent && setContentSize(widget, json["Size"]);

        var name = json["Name"];
        if (name)
            widget.setName(name);

        var actionTag = json["ActionTag"] || 0;
        widget.setActionTag(actionTag);
        var extensionData = new ccs.ObjectExtensionData();
        var customProperty = json["UserData"];
        if(customProperty !== undefined)
            extensionData.setCustomProperty(customProperty);
        extensionData.setActionTag(actionTag);
        widget.setUserObject(extensionData);

        var rotationSkewX = json["RotationSkewX"];
        if (rotationSkewX)
            widget.setRotationX(rotationSkewX);

        var rotationSkewY = json["RotationSkewY"];
        if (rotationSkewY)
            widget.setRotationY(rotationSkewY);

        //var rotation = json["Rotation"];

        var flipX = json["FlipX"];
        if (flipX)
            widget.setFlippedX(true);

        var flipY = json["FlipY"];
        if (flipY)
            widget.setFlippedY(true);

        var zOrder = json["zOrder"];
        if (zOrder != null)
            widget.setLocalZOrder(zOrder);

        //var visible = json["Visible"];

        var visible = getParam(json["VisibleForFrame"], true);
        widget.setVisible(visible);

        var alpha = json["Alpha"];
        if (alpha != null)
            widget.setOpacity(alpha);

        widget.setTag(json["Tag"] || 0);

        var touchEnabled = json["TouchEnable"] || false;
        widget.setTouchEnabled(touchEnabled);

        // -- var frameEvent = json["FrameEvent"];

        var callBackType = json["CallBackType"];
        if (callBackType != null)
            widget.setCallbackType(callBackType);

        var callBackName = json["CallBackName"];
        if (callBackName)
            widget.setCallbackName(callBackName);

        var position = json["Position"];
        if (position != null)
            widget.setPosition(position["X"] || 0, position["Y"] || 0);

        var scale = json["Scale"];
        if (scale != null) {
            var scaleX = getParam(scale["ScaleX"], 1);
            var scaleY = getParam(scale["ScaleY"], 1);
            widget.setScaleX(scaleX);
            widget.setScaleY(scaleY);
        }

        var anchorPoint = json["AnchorPoint"];
        if (anchorPoint != null)
            widget.setAnchorPoint(anchorPoint["ScaleX"] || 0, anchorPoint["ScaleY"] || 0);

        var color = json["CColor"];
        if (color != null)
            widget.setColor(getColor(color));

        setLayoutComponent(widget, json);
    };

    var setLayoutComponent = function(widget, json){

        var layoutComponent = ccui.LayoutComponent.bindLayoutComponent(widget);
        if(!layoutComponent)
            return;

        var positionXPercentEnabled = json["PositionPercentXEnable"] || json["PositionPercentXEnabled"] || false;
        var positionYPercentEnabled = json["PositionPercentYEnable"] || json["PositionPercentYEnabled"] || false;
        var positionXPercent = 0,
            positionYPercent = 0,
            PrePosition = json["PrePosition"];
        if (PrePosition != null) {
            positionXPercent = PrePosition["X"] || 0;
            positionYPercent = PrePosition["Y"] || 0;
        }
        var sizeXPercentEnable = json["PercentWidthEnable"] || false;
        var sizeYPercentEnable = json["PercentHeightEnable"] || false;
        var sizeXPercent = 0,
            sizeYPercent = 0,
            PreSize = json["PreSize"];
        if (PrePosition != null) {
            sizeXPercent = PreSize["X"] || 0;
            sizeYPercent = PreSize["Y"] || 0;
        }
        var stretchHorizontalEnabled = json["StretchWidthEnable"] || false;
        var stretchVerticalEnabled = json["StretchHeightEnable"] || false;
        var horizontalEdge = json["HorizontalEdge"];// = ccui.LayoutComponent.horizontalEdge.LEFT;
        var verticalEdge = json["VerticalEdge"]; // = ccui.LayoutComponent.verticalEdge.TOP;
        var leftMargin = json["LeftMargin"] || 0;
        var rightMargin = json["RightMargin"] || 0;
        var topMargin = json["TopMargin"] || 0;
        var bottomMargin = json["BottomMargin"] || 0;

        layoutComponent.setPositionPercentXEnabled(positionXPercentEnabled);
        layoutComponent.setPositionPercentYEnabled(positionYPercentEnabled);
        layoutComponent.setPositionPercentX(positionXPercent);
        layoutComponent.setPositionPercentY(positionYPercent);
        layoutComponent.setPercentWidthEnabled(sizeXPercentEnable);
        layoutComponent.setPercentHeightEnabled(sizeYPercentEnable);
        layoutComponent.setPercentWidth(sizeXPercent);
        layoutComponent.setPercentHeight(sizeYPercent);
        layoutComponent.setStretchWidthEnabled(stretchHorizontalEnabled);
        layoutComponent.setStretchHeightEnabled(stretchVerticalEnabled);

        var horizontalEdgeType = ccui.LayoutComponent.horizontalEdge.NONE;
        if (horizontalEdge === "LeftEdge") {
            horizontalEdgeType = ccui.LayoutComponent.horizontalEdge.LEFT;
        } else if (horizontalEdge === "RightEdge") {
            horizontalEdgeType = ccui.LayoutComponent.horizontalEdge.RIGHT;
        } else if (horizontalEdge === "BothEdge") {
            horizontalEdgeType = ccui.LayoutComponent.horizontalEdge.CENTER;
        }
        layoutComponent.setHorizontalEdge(horizontalEdgeType);

        var verticalEdgeType = ccui.LayoutComponent.verticalEdge.NONE;
        if (verticalEdge === "TopEdge") {
            verticalEdgeType = ccui.LayoutComponent.verticalEdge.TOP;
        } else if (verticalEdge === "BottomEdge") {
            verticalEdgeType = ccui.LayoutComponent.verticalEdge.BOTTOM;
        } else if (verticalEdge === "BothEdge") {
            verticalEdgeType = ccui.LayoutComponent.verticalEdge.CENTER;
        }
        layoutComponent.setVerticalEdge(verticalEdgeType);

        layoutComponent.setTopMargin(topMargin);
        layoutComponent.setBottomMargin(bottomMargin);
        layoutComponent.setLeftMargin(leftMargin);
        layoutComponent.setRightMargin(rightMargin);

        layoutComponent.setVerticalEdge(verticalEdgeType);

        layoutComponent.setTopMargin(topMargin);
        layoutComponent.setBottomMargin(bottomMargin);
        layoutComponent.setLeftMargin(leftMargin);
        layoutComponent.setRightMargin(rightMargin);
    };

    var setLayoutBackground = function(layout, single, first, end){
        if( layout.getBackGroundColorType() === 2 ){
            first = first || {};
            end = end || {};
            layout.setBackGroundColor(getColor(first), getColor(end));
        }else{
            single = single || {};
            layout.setBackGroundColor(getColor(single));
        }
    };

    var setLayoutBackgroundVector = function(widget, vector){
        var x = vector["ScaleX"] || 0;
        var y = vector["ScaleY"] || 0;
        widget.setBackGroundColorVector(cc.p(x, y));
    };

    /**
     * Layout
     * @param json
     * @param resourcePath
     * @returns {ccui.Layout}
     */
    parser.initPanel = function(json, resourcePath){
        var widget = new ccui.Layout();

        this.widgetAttributes(widget, json);

        var clipEnabled = json["ClipAble"];
        if(clipEnabled != null)
            widget.setClippingEnabled(clipEnabled);

        var colorType = getParam(json["ComboBoxIndex"], 0);
        widget.setBackGroundColorType(colorType);

        var bgColorOpacity = getParam(json["BackColorAlpha"], 255);
        if(bgColorOpacity != null)
            widget.setBackGroundColorOpacity(bgColorOpacity);

        var backGroundScale9Enabled = json["Scale9Enable"];
        if(backGroundScale9Enabled != null)
            widget.setBackGroundImageScale9Enabled(backGroundScale9Enabled);

        var opacity = getParam(json["Alpha"], 255);
        widget.setOpacity(opacity);

        loadTexture(json["FileData"], resourcePath, function(path, type){
            widget.setBackGroundImage(path, type);
        });

        if(backGroundScale9Enabled){
            var scale9OriginX = json["Scale9OriginX"] || 0;
            var scale9OriginY = json["Scale9OriginY"] || 0;

            var scale9Width = json["Scale9Width"] || 0;
            var scale9Height = json["Scale9Height"] || 0;

            widget.setBackGroundImageCapInsets(cc.rect(
                scale9OriginX, scale9OriginY, scale9Width, scale9Height
            ));

            setContentSize(widget, json["Size"]);
        }else{
            if (!widget.isIgnoreContentAdaptWithSize()){
                setContentSize(widget, json["Size"]);
            }

        }

        setLayoutBackground(widget, json["SingleColor"], json["FirstColor"], json["EndColor"]);
        setLayoutBackgroundVector(widget, json["ColorVector"]);

        return widget;
    };

    /**
     * Text
     * @param json
     * @param resourcePath
     */
    parser.initText = function(json, resourcePath){

        var widget = new ccui.Text();

        var touchScaleEnabled = json["TouchScaleChangeAble"];
        if(touchScaleEnabled != null)
            widget.setTouchScaleChangeEnabled(touchScaleEnabled);

        var text = json["LabelText"];
        if(text != null)
            widget.setString(text);

        var fontSize = json["FontSize"];
        if(fontSize != null)
            widget.setFontSize(fontSize);

        var fontName = json["FontName"];
        if(fontName != null)
            widget.setFontName(fontName);

        var areaWidth = json["AreaWidth"];
        var areaHeight = json["areaHeight"];
        if(areaWidth && areaHeight)
            widget.setTextAreaSize(cc.size(areaWidth, areaHeight));

        var h_alignment = json["HorizontalAlignmentType"] || "HT_Left";
        switch(h_alignment){
            case "HT_Right":
                h_alignment = 2; break;
            case "HT_Center":
                h_alignment = 1; break;
            case "HT_Left":
            default:
                h_alignment = 0;
        }
        widget.setTextHorizontalAlignment(h_alignment);

        var v_alignment = json["VerticalAlignmentType"] || "VT_Top";
        switch(v_alignment){
            case "VT_Bottom":
                v_alignment = 2; break;
            case "VT_Center":
                v_alignment = 1; break;
            case "VT_Top":
            default:
                v_alignment = 0;
        }
        widget.setTextVerticalAlignment(v_alignment);

        var fontResource = json["FontResource"];
        if(fontResource != null){
            var path = fontResource["Path"];
            //resoutceType = fontResource["Type"];
            if(path != null){
                if (cc.sys.isNative) {
                    fontName = cc.path.join(cc.loader.resPath, resourcePath, path);
                } else {
                    fontName = path.match(/([^\/]+)\.ttf/);
                    fontName = fontName ? fontName[1] : "";
                }
                widget.setFontName(fontName);
            }
        }

        if(json["OutlineEnabled"] && json["OutlineColor"] && widget.enableOutline)
            widget.enableOutline(getColor(json["OutlineColor"]), getParam(json["OutlineSize"], 1));

        if(json["ShadowEnabled"] && json["ShadowColor"] && widget.enableShadow)
            widget.enableShadow(
                getColor(json["ShadowColor"]),
                cc.size(getParam(json["ShadowOffsetX"], 2), getParam(json["ShadowOffsetY"], -2)),
                json["ShadowBlurRadius"] || 0
            );

        var isCustomSize = json["IsCustomSize"];
        if(isCustomSize != null)
            widget.ignoreContentAdaptWithSize(!isCustomSize);

        widget.setUnifySizeEnabled(false);

        var color = json["CColor"];
        json["CColor"] = null;
        widget.setTextColor(getColor(color));
        this.widgetAttributes(widget, json, widget.isIgnoreContentAdaptWithSize());
        json["CColor"] = color;
        return widget;

    };

    /**
     * Button
     * @param json
     * @param resourcePath
     */
    parser.initButton = function(json, resourcePath){

        var widget = new ccui.Button();

        loadTexture(json["NormalFileData"], resourcePath, function(path, type){
            widget.loadTextureNormal(path, type);
        });
        loadTexture(json["PressedFileData"], resourcePath, function(path, type){
            widget.loadTexturePressed(path, type);
        });
        loadTexture(json["DisabledFileData"], resourcePath, function(path, type){
            widget.loadTextureDisabled(path, type);
        });

        var scale9Enabled = getParam(json["Scale9Enable"], false);
        if(scale9Enabled) {
            widget.setScale9Enabled(scale9Enabled);
        }

        var text = json["ButtonText"];
        if(text != null)
            widget.setTitleText(text);

        var fontSize = json["FontSize"];
        if(fontSize != null)
            widget.setTitleFontSize(fontSize);

        var fontName = json["FontName"];
        if(fontName != null)
            widget.setTitleFontName(fontName);

        var textColor = json["TextColor"];
        if(textColor != null)
            widget.setTitleColor(getColor(textColor));

        var displaystate = getParam(json["DisplayState"], true);
        widget.setBright(displaystate);
        widget.setEnabled(displaystate);

        var fontResource = json["FontResource"];
        if(fontResource != null){
            var path = fontResource["Path"];
            //resoutceType = fontResource["Type"];
            if(path != null){
                if (cc.sys.isNative) {
                    fontName = cc.path.join(cc.loader.resPath, resourcePath, path);
                } else {
                    fontName = path.match(/([^\/]+)\.(\S+)/);
                    fontName = fontName ? fontName[1] : "";
                }
                widget.setTitleFontName(fontName);
            }
        }

        var label = widget.getTitleRenderer();
        if(label && json["ShadowEnabled"] && json["ShadowColor"] && label.enableShadow){
            label.enableShadow(
                getColor(json["ShadowColor"]),
                cc.size(getParam(json["ShadowOffsetX"], 2), getParam(json["ShadowOffsetY"], -2)),
                json["ShadowBlurRadius"] || 0
            );
        }
        if(label && json["OutlineEnabled"] && json["OutlineColor"] && label.enableStroke)
            label.enableStroke(getColor(json["OutlineColor"]), getParam(json["OutlineSize"], 1));

        this.widgetAttributes(widget, json);

        if(scale9Enabled) {
            widget.setUnifySizeEnabled(false);
            widget.ignoreContentAdaptWithSize(false);
            var capInsets = cc.rect(
                    json["Scale9OriginX"] || 0,
                    json["Scale9OriginY"] || 0,
                    json["Scale9Width"] || 0,
                    json["Scale9Height"] || 0
            );
            widget.setCapInsets(capInsets);

        }

        setContentSize(widget, json["Size"]);

        return widget;

    };

    /**
     * CheckBox
     * @param json
     * @param resourcePath
     */
    parser.initCheckBox = function(json, resourcePath){

        var widget = new ccui.CheckBox();

        this.widgetAttributes(widget, json);

        var dataList = [
            {name: "NormalBackFileData", handle: widget.loadTextureBackGround},
            {name: "PressedBackFileData", handle: widget.loadTextureBackGroundSelected},
            {name: "NodeNormalFileData", handle: widget.loadTextureFrontCross},
            {name: "DisableBackFileData", handle: widget.loadTextureBackGroundDisabled},
            {name: "NodeDisableFileData", handle: widget.loadTextureFrontCrossDisabled}
        ];

        dataList.forEach(function(item){
            loadTexture(json[item.name], resourcePath, function(path, type){
                item.handle.call(widget, path, type);
            });
        });

        var selectedState = getParam(json["CheckedState"], false);
        widget.setSelected(selectedState);

        var displaystate = getParam(json["DisplayState"], true);
        widget.setBright(displaystate);
        widget.setEnabled(displaystate);

        return widget;
    };

    /**
     * ScrollView
     * @param json
     * @param resourcePath
     */
    parser.initScrollView = function(json, resourcePath){
        var widget = new ccui.ScrollView();

        this.widgetAttributes(widget, json);

        loadTexture(json["FileData"], resourcePath, function(path, type){
            widget.setBackGroundImage(path, type);
        });

        var clipEnabled = json["ClipAble"];
        widget.setClippingEnabled(clipEnabled);

        var colorType = getParam(json["ComboBoxIndex"], 0);
        widget.setBackGroundColorType(colorType);

        var bgColorOpacity = json["BackColorAlpha"];
        if(bgColorOpacity != null)
            widget.setBackGroundColorOpacity(bgColorOpacity);

        var backGroundScale9Enabled = json["Scale9Enable"];
        if(backGroundScale9Enabled){
            widget.setBackGroundImageScale9Enabled(true);


            var scale9OriginX = json["Scale9OriginX"] || 0;
            var scale9OriginY = json["Scale9OriginY"] || 0;
            var scale9Width = json["Scale9Width"] || 0;
            var scale9Height = json["Scale9Height"] || 0;
            widget.setBackGroundImageCapInsets(cc.rect(
                scale9OriginX, scale9OriginY, scale9Width, scale9Height
            ));
            setContentSize(widget, json["Size"]);
        }else if(!widget.isIgnoreContentAdaptWithSize()){
            setContentSize(widget, json["Size"]);
        }

        setLayoutBackground(widget, json["SingleColor"], json["FirstColor"], json["EndColor"]);
        setLayoutBackgroundVector(widget, json["ColorVector"]);

        var innerNodeSize = json["InnerNodeSize"];
        var innerSize = cc.size(
            innerNodeSize["Width"] || 0,
            innerNodeSize["Height"] || 0
        );
        widget.setInnerContainerSize(innerSize);

        var direction = 0;
        if(json["ScrollDirectionType"] === "Vertical") direction = 1;
        if(json["ScrollDirectionType"] === "Horizontal") direction = 2;
        if(json["ScrollDirectionType"] === "Vertical_Horizontal") direction = 3;
        widget.setDirection(direction);

        var bounceEnabled = getParam(json["IsBounceEnabled"], false);
        widget.setBounceEnabled(bounceEnabled);

        return widget;
    };

    /**
     * ImageView
     * @param json
     * @param resourcePath
     */
    parser.initImageView = function(json, resourcePath){

        var widget = new ccui.ImageView();

        loadTexture(json["FileData"], resourcePath, function(path, type){
            widget.loadTexture(path, type);
        });
        loadTexture(json["ImageFileData"], resourcePath, function(path, type){
            widget.loadTexture(path, type);
        });

        var scale9Enabled = json["Scale9Enable"];
        if(scale9Enabled){
            widget.setScale9Enabled(true);
            widget.setUnifySizeEnabled(false);
            widget.ignoreContentAdaptWithSize(false);

            var scale9OriginX = json["Scale9OriginX"] || 0;
            var scale9OriginY = json["Scale9OriginY"] || 0;
            var scale9Width = json["Scale9Width"] || 0;
            var scale9Height = json["Scale9Height"] || 0;
            widget.setCapInsets(cc.rect(
                scale9OriginX ,
                scale9OriginY,
                scale9Width,
                scale9Height
            ));
        } else
            setContentSize(widget, json["Size"]);

        this.widgetAttributes(widget, json);

        return widget;
    };

    /**
     * LoadingBar
     * @param json
     * @param resourcePath
     * @returns {ccui.LoadingBar}
     */
    parser.initLoadingBar = function(json, resourcePath){

        var widget = new ccui.LoadingBar();

        this.widgetAttributes(widget, json);

        loadTexture(json["ImageFileData"], resourcePath, function(path, type){
            widget.loadTexture(path, type);
        });

        var direction = json["ProgressType"] === "Right_To_Left" ? 1 : 0;
        widget.setDirection(direction);

        var percent = getParam(json["ProgressInfo"], 80);
        if(percent != null)
            widget.setPercent(percent);

        return widget;

    };

    /**
     * Slider
     * @param json
     * @param resourcePath
     */
    parser.initSlider = function(json, resourcePath){

        var widget = new ccui.Slider();
        var loader = cc.loader;

        this.widgetAttributes(widget, json);

        var textureList = [
            {name: "BackGroundData", handle: widget.loadBarTexture},
            {name: "BallNormalData", handle: widget.loadSlidBallTextureNormal},
            {name: "BallPressedData", handle: widget.loadSlidBallTexturePressed},
            {name: "BallDisabledData", handle: widget.loadSlidBallTextureDisabled},
            {name: "ProgressBarData", handle: widget.loadProgressBarTexture}
        ];
        textureList.forEach(function(item){
            loadTexture(json[item.name], resourcePath, function(path, type){
                if(type === 0 && !loader.getRes(path))
                    cc.log("%s need to be preloaded", path);
                item.handle.call(widget, path, type);
            });
        });

        var percent = json["PercentInfo"] || 0;
        widget.setPercent(percent);

        var displaystate = getParam(json["DisplayState"], true);
        widget.setBright(displaystate);
        widget.setEnabled(displaystate);

        return widget;
    };

    /**
     * PageView
     * @param json
     * @param resourcePath
     */
    parser.initPageView = function(json, resourcePath){

        var widget = new ccui.PageView();

        this.widgetAttributes(widget, json);

        loadTexture(json["FileData"], resourcePath, function(path, type){
            widget.setBackGroundImage(path, type);
        });

        var clipEnabled = json["ClipAble"] || false;
        widget.setClippingEnabled(clipEnabled);

        var backGroundScale9Enabled = json["Scale9Enable"];
        if(backGroundScale9Enabled){
            widget.setBackGroundImageScale9Enabled(true);

            var scale9OriginX = json["Scale9OriginX"] || 0;
            var scale9OriginY = json["Scale9OriginY"] || 0;
            var scale9Width = json["Scale9Width"] || 0;
            var scale9Height = json["Scale9Height"] || 0;
            widget.setBackGroundImageCapInsets(cc.rect(
                scale9OriginX,
                scale9OriginY,
                scale9Width,
                scale9Height
            ));
        }

        var colorType = getParam(json["ComboBoxIndex"], 0);
        widget.setBackGroundColorType(colorType);

        setLayoutBackground(widget, json["SingleColor"], json["FirstColor"], json["EndColor"]);
        setLayoutBackgroundVector(widget, json["ColorVector"]);

        var bgColorOpacity = json["BackColorAlpha"];
        if(bgColorOpacity != null)
            widget.setBackGroundColorOpacity(bgColorOpacity);

        setContentSize(widget, json["Size"]);

        return widget;

    };

    /**
     * ListView
     * @param json
     * @param resourcePath
     * @returns {ccui.ListView}
     */
    parser.initListView = function(json, resourcePath){

        var widget = new ccui.ListView();

        this.widgetAttributes(widget, json);

        loadTexture(json["FileData"], resourcePath, function(path, type){
            widget.setBackGroundImage(path, type);
        });

        var clipEnabled = json["ClipAble"] || false;
        widget.setClippingEnabled(clipEnabled);

        var colorType = getParam(json["ComboBoxIndex"], 0);
        widget.setBackGroundColorType(colorType);

        var bgColorOpacity = getParam(json["BackColorAlpha"], 255);
        var backGroundScale9Enabled = json["Scale9Enable"];
        if(backGroundScale9Enabled){
            widget.setBackGroundImageScale9Enabled(true);

            var scale9OriginX = json["Scale9OriginX"] || 0;
            var scale9OriginY = json["Scale9OriginY"] || 0;
            var scale9Width = json["Scale9Width"] || 0;
            var scale9Height = json["Scale9Height"] || 0;
            widget.setBackGroundImageCapInsets(cc.rect(
                scale9OriginX,
                scale9OriginY,
                scale9Width,
                scale9Height
            ));
        }

        var directionType = getParam(json["DirectionType"], ccui.ListView.DIR_HORIZONTAL);
        var verticalType = getParam(json["VerticalType"], "Align_Left");
        var horizontalType = getParam(json["HorizontalType"], "Align_Top");
        if(!directionType){
            widget.setDirection(ccui.ScrollView.DIR_HORIZONTAL);
            if(verticalType === "Align_Bottom")
                widget.setGravity(ccui.ListView.GRAVITY_BOTTOM);
            else if(verticalType === "Align_VerticalCenter")
                widget.setGravity(ccui.ListView.GRAVITY_CENTER_VERTICAL);
            else
                widget.setGravity(ccui.ListView.GRAVITY_TOP);
        }else if(directionType === "Vertical"){
            widget.setDirection(ccui.ScrollView.DIR_VERTICAL);
            if (horizontalType === "")
                widget.setGravity(ccui.ListView.GRAVITY_LEFT);
            else if (horizontalType === "Align_Right")
                widget.setGravity(ccui.ListView.GRAVITY_RIGHT);
            else if (horizontalType === "Align_HorizontalCenter")
                widget.setGravity(ccui.ListView.GRAVITY_CENTER_HORIZONTAL);
        }


        var bounceEnabled = getParam(json["IsBounceEnabled"], false);
        widget.setBounceEnabled(bounceEnabled);

        var itemMargin = json["ItemMargin"] || 0;
        widget.setItemsMargin(itemMargin);

        var innerSize = json["InnerNodeSize"];
        //Width
        if(innerSize != null)
            widget.setInnerContainerSize(cc.size(innerSize["Widget"]||0, innerSize["Height"]||0));

        setLayoutBackground(widget, json["SingleColor"], json["FirstColor"], json["EndColor"]);
        setLayoutBackgroundVector(widget, json["ColorVector"]);

        if(bgColorOpacity != null)
            widget.setBackGroundColorOpacity(bgColorOpacity);

        setContentSize(widget, json["Size"]);

        return widget;
    };

    /**
     * TextAtlas
     * @param json
     * @param resourcePath
     * @returns {ccui.TextAtlas}
     */
    parser.initTextAtlas = function(json, resourcePath){

        var widget = new ccui.TextAtlas();

        var stringValue = json["LabelText"];
        var itemWidth = json["CharWidth"];
        var itemHeight = json["CharHeight"];

        var startCharMap = json["StartChar"];

        loadTexture(json["LabelAtlasFileImage_CNB"], resourcePath, function(path, type){
            if(!cc.loader.getRes(path))
                cc.log("%s need to be preloaded", path);
            if(type === 0){
                widget.setProperty(stringValue, path, itemWidth, itemHeight, startCharMap);
            }
        });
        this.widgetAttributes(widget, json);

        return widget;
    };

    /**
     * TextBMFont
     * @param json
     * @param resourcePath
     * @returns {ccui.TextBMFont}
     */
    parser.initTextBMFont = function(json, resourcePath){

        var widget = new ccui.TextBMFont();
        this.widgetAttributes(widget, json);

        var text = json["LabelText"];
        widget.setString(text);

        loadTexture(json["LabelBMFontFile_CNB"], resourcePath, function(path, type){
            if(!cc.loader.getRes(path))
                cc.log("%s need to be pre loaded", path);
            widget.setFntFile(path);
        });
        widget.ignoreContentAdaptWithSize(true);
        return widget;
    };

    /**
     * TextField
     * @param json
     * @param resourcePath
     * @returns {ccui.TextField}
     */
    parser.initTextField = function(json, resourcePath){
        var widget = new ccui.TextField();

        var passwordEnabled = json["PasswordEnable"];
        if(passwordEnabled){
            widget.setPasswordEnabled(true);
            var passwordStyleText = json["PasswordStyleText"] || "*";
            widget.setPasswordStyleText(passwordStyleText);
        }

        var placeHolder = json["PlaceHolderText"];
        if(placeHolder != null)
            widget.setPlaceHolder(placeHolder);

        var fontSize = json["FontSize"];
        if(fontSize != null)
            widget.setFontSize(fontSize);

        var fontName = json["FontName"];
        if(fontName != null)
            widget.setFontName(fontName);

        var maxLengthEnabled = json["MaxLengthEnable"];
        if(maxLengthEnabled){
            widget.setMaxLengthEnabled(true);
            var maxLength = json["MaxLengthText"] || 0;
            widget.setMaxLength(maxLength);
        }

        //var isCustomSize = json["IsCustomSize"];
        this.widgetAttributes(widget, json);

        var text = json["LabelText"];
        if(text != null)
            widget.setString(text);

        var fontResource = json["FontResource"];
        if(fontResource != null){
            var path = fontResource["Path"];
            //resoutceType = fontResource["Type"];
            if(path != null){
                if (cc.sys.isNative) {
                    fontName = cc.path.join(cc.loader.resPath, resourcePath, path);
                } else {
                    fontName = path.match(/([^\/]+)\.ttf/);
                    fontName = fontName ? fontName[1] : "";
                }
                widget.setFontName(fontName);
            }
        }

        widget.setUnifySizeEnabled(false);
        widget.ignoreContentAdaptWithSize(false);

        var color = json["CColor"];
        if(color != null)
            widget.setTextColor(getColor(color));

        if (!widget.isIgnoreContentAdaptWithSize()){
            setContentSize(widget, json["Size"]);
            if (cc.sys.isNative)
                widget.getVirtualRenderer().setLineBreakWithoutSpace(true);
        }


        return widget;

    };

    /**
     * SimpleAudio
     * @param json
     * @param resourcePath
     */
    parser.initSimpleAudio = function(json, resourcePath){

        var loop = json["Loop"] || false;
        var volume = json["Volume"] || 0;
        cc.audioEngine.setMusicVolume(volume);
        //var name = json["Name"];

        loadTexture(json["FileData"], resourcePath, function(path, type){
            cc.loader.load(path, function(){
                cc.audioEngine.playMusic(path, loop);
            });
        });

    };

    /**
     * GameMap
     * @param json
     * @param resourcePath
     * @returns {*}
     */
    parser.initGameMap = function(json, resourcePath){

        var node = null;

        loadTexture(json["FileData"], resourcePath, function(path, type){
            if(type === 0)
                node = new cc.TMXTiledMap(path);

            parser.generalAttributes(node, json);
        });

        return node;
    };

    /**
     * ProjectNode
     * @param json
     * @param resourcePath
     * @returns {*}
     */
    parser.initProjectNode = function(json, resourcePath){
        var projectFile = json["FileData"];
        if(projectFile != null && projectFile["Path"]){
            var file = resourcePath + projectFile["Path"];
            if(cc.loader.getRes(file)){
                var obj = ccs.load(file, resourcePath);
                parser.generalAttributes(obj.node, json);
                if(obj.action && obj.node){
                    obj.action.tag = obj.node.tag;
                    var InnerActionSpeed = json["InnerActionSpeed"];
                    if(InnerActionSpeed !== undefined)
                        obj.action.setTimeSpeed(InnerActionSpeed);
                    obj.node.runAction(obj.action);
                    obj.action.gotoFrameAndPause(0);
                }
                return obj.node;
            } else
                cc.log("%s need to be preloaded", file);
        }
    };

    var getFileName = function(name){
        if(!name) return "";
        var arr = name.match(/([^\/]+)\.[^\/]+$/);
        if(arr && arr[1])
            return arr[1];
        else
            return "";
    };

    /**
     * Armature
     * @param json
     * @param resourcePath
     */
    parser.initArmature = function(json, resourcePath){

        var node = new ccs.Armature();

        var isLoop = json["IsLoop"];

        var isAutoPlay = json["IsAutoPlay"];

        var currentAnimationName = json["CurrentAnimationName"];

        parser.generalAttributes(node, json);

        loadTexture(json["FileData"], resourcePath, function(path, type){
            var plists, pngs;
            var armJson = cc.loader.getRes(path);
            if(!armJson)
                cc.log("%s need to be preloaded", path);
            else{
                plists = armJson["config_file_path"];
                pngs = armJson["config_png_path"];
                plists.forEach(function(plist, index){
                    if(pngs[index])
                        cc.spriteFrameCache.addSpriteFrames(plist, pngs[index]);
                });
            }
            ccs.armatureDataManager.addArmatureFileInfo(path);
            node.init(getFileName(path));
            if(isAutoPlay)
                node.getAnimation().play(currentAnimationName, -1, isLoop);

        });
        node.setColor(getColor(json["CColor"]));
        return node;
    };

    var loadedPlist = {};
    var loadTexture = function(json, resourcePath, cb){
        if(json != null){
            var path = json["Path"];
            var type;
            if(json["Type"] === "Default" || json["Type"] === "Normal")
                type = 0;
            else
                type = 1;
            var plist = json["Plist"];
            if(plist){
                if(cc.loader.getRes(resourcePath + plist)){
                    loadedPlist[resourcePath + plist] = true;
                    cc.spriteFrameCache.addSpriteFrames(resourcePath + plist);
                }else{
                    if(!loadedPlist[resourcePath + plist])
                        cc.log("%s need to be preloaded", resourcePath + plist);
                }
            }
            if(type !== 0)
                cb(path, type);
            else
                cb(resourcePath + path, type);
        }
    };

    var getColor = function(json){
        if(!json) return;
        var r = json["R"] != null ? json["R"] : 255;
        var g = json["G"] != null ? json["G"] : 255;
        var b = json["B"] != null ? json["B"] : 255;
        var a = json["A"] != null ? json["A"] : 255;
        return cc.color(r, g, b, a);
    };

    var setContentSize = function(node, size){
        var x = size["X"] || 0;
        var y = size["Y"] || 0;
        if(size)
            node.setContentSize(cc.size(x, y));
    };

    var register = [
        {name: "SingleNodeObjectData", handle: parser.initSingleNode},
        {name: "NodeObjectData", handle: parser.initSingleNode},
        {name: "LayerObjectData", handle: parser.initSingleNode},
        {name: "SpriteObjectData", handle: parser.initSprite},
        {name: "ParticleObjectData", handle: parser.initParticle},
        {name: "PanelObjectData", handle: parser.initPanel},
        {name: "TextObjectData", handle: parser.initText},
        {name: "ButtonObjectData", handle: parser.initButton},
        {name: "CheckBoxObjectData", handle: parser.initCheckBox},
        {name: "ScrollViewObjectData", handle: parser.initScrollView},
        {name: "ImageViewObjectData", handle: parser.initImageView},
        {name: "LoadingBarObjectData", handle: parser.initLoadingBar},
        {name: "SliderObjectData", handle: parser.initSlider},
        {name: "PageViewObjectData", handle: parser.initPageView},
        {name: "ListViewObjectData", handle: parser.initListView},
        {name: "TextAtlasObjectData", handle: parser.initTextAtlas},
        {name: "TextBMFontObjectData", handle: parser.initTextBMFont},
        {name: "TextFieldObjectData", handle: parser.initTextField},
        {name: "SimpleAudioObjectData", handle: parser.initSimpleAudio},
        {name: "GameMapObjectData", handle: parser.initGameMap},
        {name: "ProjectNodeObjectData", handle: parser.initProjectNode},
        {name: "ArmatureNodeObjectData", handle: parser.initArmature}
    ];

    register.forEach(function(item){
        parser.registerParser(item.name, function(options, resourcePath){
            var node = item.handle.call(this, options, resourcePath);
            this.parseChild(node, options["Children"], resourcePath);
            DEBUG && node && (node.__parserName = item.name);
            return node;
        });
    });


    load.registerParser("timeline", "2.*", parser);


})(ccs._load, ccs._parser);
