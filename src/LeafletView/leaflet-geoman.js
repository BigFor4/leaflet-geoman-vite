import * as L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';
import lineIntersect from '@turf/line-intersect';
import lineSplit from '@turf/line-split';
import booleanContains from '@turf/boolean-contains';
import kinks from '@turf/kinks';
import * as polygonClipping from 'polyclip-ts';
import merge from 'lodash/merge';
import get from 'lodash/get';
var en_default = {
  tooltips: {
    placeMarker: "Click to place marker",
    firstVertex: "Click to place first vertex",
    continueLine: "Click to continue drawing",
    finishLine: "Click any existing marker to finish",
    finishPoly: "Click first marker to finish",
    finishRect: "Click to finish",
    startCircle: "Click to place circle center",
    finishCircle: "Click to finish circle",
    placeCircleMarker: "Click to place circle marker",
    placeText: "Click to place text",
    selectFirstLayerFor: "Select first layer for {action}",
    selectSecondLayerFor: "Select second layer for {action}"
  },
  actions: {
    finish: "Finish",
    cancel: "Cancel",
    removeLastVertex: "Remove Last Vertex"
  },
  buttonTitles: {
    drawMarkerButton: "Draw Marker",
    drawPolyButton: "Draw Polygons",
    drawLineButton: "Draw Polyline",
    drawCircleButton: "Draw Circle",
    drawRectButton: "Draw Rectangle",
    editButton: "Edit Layers",
    dragButton: "Drag Layers",
    cutButton: "Cut Layers",
    deleteButton: "Remove Layers",
    drawCircleMarkerButton: "Draw Circle Marker",
    snappingButton: "Snap dragged marker to other layers and vertices",
    pinningButton: "Pin shared vertices together",
    rotateButton: "Rotate Layers",
    drawTextButton: "Draw Text",
    scaleButton: "Scale Layers",
    autoTracingButton: "Auto trace Line",
    snapGuidesButton: "Show SnapGuides",
    unionButton: "Union layers",
    differenceButton: "Subtract layers"
  },
  measurements: {
    totalLength: "Length",
    segmentLength: "Segment length",
    area: "Area",
    radius: "Radius",
    perimeter: "Perimeter",
    height: "Height",
    width: "Width",
    coordinates: "Position",
    coordinatesMarker: "Position Marker"
  }
};

var translations_default = {
  en: en_default,
};

// Mode.Edit.js
var GlobalEditMode = {
  _globalEditModeEnabled: false,
  enableGlobalEditMode(o) {
    const options = {
      ...o
    };
    console.log(options);
    this._editOption = options;
    this._globalEditModeEnabled = true;
    this.Toolbar.toggleButton("editMode", this.getGlobalEditModeEnabled());
    if (!this.throttledReInitEdit) {
      this.throttledReInitEdit = L.Util.throttle(
        this.handleLayerAdditionInGlobalEditMode,
        100,
        this
      );
    }
    this._addedLayersEdit = {};
    this.map.on("layeradd", this._layerAddedEdit, this);
    this.map.on("layeradd", this.throttledReInitEdit, this);
    this._fireGlobalEditModeToggled(true);
  },
  disableGlobalEditMode() {
    this._globalEditModeEnabled = false;
    this._editOption = null;
    const layers = L.PM.Utils.findLayers(this.map);
    layers.forEach((layer) => {
      layer.pm.disable();
    });
    this.map.off("layeradd", this._layerAddedEdit, this);
    this.map.off("layeradd", this.throttledReInitEdit, this);
    this.Toolbar.toggleButton("editMode", this.getGlobalEditModeEnabled());
    this._fireGlobalEditModeToggled(false);
  },
  getGlobalEditModeEnabled() {
    return this._globalEditModeEnabled;
  },
  // TODO: this should maybe removed, it will overwrite explicit options on the layers
  toggleGlobalEditMode(options = this.globalOptions) {
    if (this.getGlobalEditModeEnabled()) {
      this.disableGlobalEditMode();
    } else {
      this.enableGlobalEditMode(options);
    }
  },
  handleLayerAdditionInGlobalEditMode() {
    const layers = this._addedLayersEdit;
    this._addedLayersEdit = {};
    if (this.getGlobalEditModeEnabled()) {
      for (const id in layers) {
        const layer = layers[id];
        if (this._isRelevantForEdit(layer)) {
          layer.pm.enable({ ...this.globalOptions });
        }
      }
    }
  },
  _layerAddedEdit({ layer }) {
    this._addedLayersEdit[L.stamp(layer)] = layer;
  },
  _isRelevantForEdit(layer) {
    return layer.pm && !(layer instanceof L.LayerGroup) && (!L.PM.optIn && !layer.options.pmIgnore || // if optIn is not set / true and pmIgnore is not set / true (default)
      L.PM.optIn && layer.options.pmIgnore === false) && // if optIn is true and pmIgnore is false
      !layer._pmTempLayer && layer.pm.options.allowEditing;
  }
};
var Mode_Edit_default = GlobalEditMode;

// Mode.Drag.js
var GlobalDragMode = {
  _globalDragModeEnabled: false,
  enableGlobalDragMode() {
    this._globalDragModeEnabled = true;
    this._addedLayersDrag = {};
    if (!this.throttledReInitDrag) {
      this.throttledReInitDrag = L.Util.throttle(
        this.reinitGlobalDragMode,
        100,
        this
      );
    }
    this.map.on("layeradd", this._layerAddedDrag, this);
    this.map.on("layeradd", this.throttledReInitDrag, this);
    this.Toolbar.toggleButton("dragMode", this.globalDragModeEnabled());
    this._fireGlobalDragModeToggled(true);
  },
  disableGlobalDragMode() {
    const layers = L.PM.Utils.findLayers(this.map);
    this._globalDragModeEnabled = false;
    layers.forEach((layer) => {
      layer.pm.disableLayerDrag();
    });
    this.map.off("layeradd", this._layerAddedDrag, this);
    this.map.off("layeradd", this.throttledReInitDrag, this);
    this.Toolbar.toggleButton("dragMode", this.globalDragModeEnabled());
    this._fireGlobalDragModeToggled(false);
  },
  globalDragModeEnabled() {
    return !!this._globalDragModeEnabled;
  },
  toggleGlobalDragMode() {
    if (this.globalDragModeEnabled()) {
      this.disableGlobalDragMode();
    } else {
      this.enableGlobalDragMode();
    }
  },
  reinitGlobalDragMode() {
    const layers = this._addedLayersDrag;
    this._addedLayersDrag = {};
    if (this.globalDragModeEnabled()) {
      for (const id in layers) {
        const layer = layers[id];
        if (this._isRelevantForDrag(layer)) {
          layer.pm.enableLayerDrag();
        }
      }
    }
  },
  _layerAddedDrag({ layer }) {
    this._addedLayersDrag[L.stamp(layer)] = layer;
  },
  _isRelevantForDrag(layer) {
    return layer.pm && !(layer instanceof L.LayerGroup) && (!L.PM.optIn && !layer.options.pmIgnore || // if optIn is not set / true and pmIgnore is not set / true (default)
      L.PM.optIn && layer.options.pmIgnore === false) && // if optIn is true and pmIgnore is false
      !layer._pmTempLayer && layer.pm.options.draggable;
  }
};
var Mode_Drag_default = GlobalDragMode;

// Mode.Removal.js
var GlobalRemovalMode = {
  _globalRemovalModeEnabled: false,
  enableGlobalRemovalMode() {
    this._globalRemovalModeEnabled = true;
    this.map.eachLayer((layer) => {
      if (this._isRelevantForRemoval(layer)) {
        if (layer.pm.enabled()) {
          layer.pm.disable();
        }
        layer.on("click", this.removeLayer, this);
      }
    });
    if (!this.throttledReInitRemoval) {
      this.throttledReInitRemoval = L.Util.throttle(
        this.handleLayerAdditionInGlobalRemovalMode,
        100,
        this
      );
    }
    this._addedLayersRemoval = {};
    this.map.on("layeradd", this._layerAddedRemoval, this);
    this.map.on("layeradd", this.throttledReInitRemoval, this);
    this.Toolbar.toggleButton("removalMode", this.globalRemovalModeEnabled());
    this._fireGlobalRemovalModeToggled(true);
  },
  disableGlobalRemovalMode() {
    this._globalRemovalModeEnabled = false;
    this.map.eachLayer((layer) => {
      layer.off("click", this.removeLayer, this);
    });
    this.map.off("layeradd", this._layerAddedRemoval, this);
    this.map.off("layeradd", this.throttledReInitRemoval, this);
    this.Toolbar.toggleButton("removalMode", this.globalRemovalModeEnabled());
    this._fireGlobalRemovalModeToggled(false);
  },
  // TODO: Remove in the next major release
  globalRemovalEnabled() {
    return this.globalRemovalModeEnabled();
  },
  globalRemovalModeEnabled() {
    return !!this._globalRemovalModeEnabled;
  },
  toggleGlobalRemovalMode() {
    if (this.globalRemovalModeEnabled()) {
      this.disableGlobalRemovalMode();
    } else {
      this.enableGlobalRemovalMode();
    }
  },
  removeLayer(e) {
    const layer = e.target;
    const removeable = this._isRelevantForRemoval(layer) && !layer.pm.dragging();
    if (removeable) {
      layer.removeFrom(this.map.pm._getContainingLayer());
      layer.remove();
      if (layer instanceof L.LayerGroup) {
        this._fireRemoveLayerGroup(layer);
        this._fireRemoveLayerGroup(this.map, layer);
      } else {
        layer.pm._fireRemove(layer);
        layer.pm._fireRemove(this.map, layer);
      }
    }
  },
  _isRelevantForRemoval(layer) {
    return layer.pm && !(layer instanceof L.LayerGroup) && (!L.PM.optIn && !layer.options.pmIgnore || // if optIn is not set / true and pmIgnore is not set / true (default)
      L.PM.optIn && layer.options.pmIgnore === false) && // if optIn is true and pmIgnore is false
      !layer._pmTempLayer && layer.pm.options.allowRemoval;
  },
  handleLayerAdditionInGlobalRemovalMode() {
    const layers = this._addedLayersRemoval;
    this._addedLayersRemoval = {};
    if (this.globalRemovalModeEnabled()) {
      for (const id in layers) {
        const layer = layers[id];
        if (this._isRelevantForRemoval(layer)) {
          if (layer.pm.enabled()) {
            layer.pm.disable();
          }
          layer.on("click", this.removeLayer, this);
        }
      }
    }
  },
  _layerAddedRemoval({ layer }) {
    this._addedLayersRemoval[L.stamp(layer)] = layer;
  }
};
var Mode_Removal_default = GlobalRemovalMode;

// Mode.Rotate.js
var GlobalRotateMode = {
  _globalRotateModeEnabled: false,
  enableGlobalRotateMode() {
    this._globalRotateModeEnabled = true;
    if (!this.throttledReInitRotate) {
      this.throttledReInitRotate = L.Util.throttle(
        this.handleLayerAdditionInGlobalRotateMode,
        100,
        this
      );
    }
    this._addedLayersRotate = {};
    this.map.on("layeradd", this._layerAddedRotate, this);
    this.map.on("layeradd", this.throttledReInitRotate, this);
    this.Toolbar.toggleButton("rotateMode", this.globalRotateModeEnabled());
    this._fireGlobalRotateModeToggled();
  },
  disableGlobalRotateMode() {
    this._globalRotateModeEnabled = false;
    const layers = L.PM.Utils.findLayers(this.map).filter(
      (l) => l instanceof L.Polyline
    );
    layers.forEach((layer) => {
      layer.pm.disableRotate();
    });
    this.map.off("layeradd", this._layerAddedRotate, this);
    this.map.off("layeradd", this.throttledReInitRotate, this);
    this.Toolbar.toggleButton("rotateMode", this.globalRotateModeEnabled());
    this._fireGlobalRotateModeToggled();
  },
  globalRotateModeEnabled() {
    return !!this._globalRotateModeEnabled;
  },
  toggleGlobalRotateMode() {
    if (this.globalRotateModeEnabled()) {
      this.disableGlobalRotateMode();
    } else {
      this.enableGlobalRotateMode();
    }
  },
  _isRelevantForRotate(layer) {
    return layer.pm && layer instanceof L.Polyline && !(layer instanceof L.LayerGroup) && (!L.PM.optIn && !layer.options.pmIgnore || // if optIn is not set / true and pmIgnore is not set / true (default)
      L.PM.optIn && layer.options.pmIgnore === false) && // if optIn is true and pmIgnore is false
      !layer._pmTempLayer && layer.pm.options.allowRotation;
  },
  handleLayerAdditionInGlobalRotateMode() {
    const layers = this._addedLayersRotate;
    this._addedLayersRotate = {};
    if (this.globalRotateModeEnabled()) {
      for (const id in layers) {
        const layer = layers[id];
        if (this._isRelevantForRemoval(layer)) {
          layer.pm.enableRotate();
        }
      }
    }
  },
  _layerAddedRotate({ layer }) {
    this._addedLayersRotate[L.stamp(layer)] = layer;
  }
};
var Mode_Rotate_default = GlobalRotateMode;

var EventMixin = {
  // Draw Events
  // Fired when enableDraw() is called -> draw start
  _fireDrawStart(source = "Draw", customPayload = {}) {
    this.__fire(
      this._map,
      "pm:drawstart",
      {
        shape: this._shape,
        workingLayer: this._layer
      },
      source,
      customPayload
    );
  },
  // Fired when disableDraw() is called -> draw stop
  _fireDrawEnd(source = "Draw", customPayload = {}) {
    this.__fire(
      this._map,
      "pm:drawend",
      {
        shape: this._shape
      },
      source,
      customPayload
    );
  },
  // Fired when layer is created while drawing
  _fireCreate(layer, source = "Draw", customPayload = {}) {
    this.__fire(
      this._map,
      "pm:create",
      {
        shape: this._shape,
        marker: layer,
        // TODO: Deprecated
        layer
      },
      source,
      customPayload
    );
  },
  // Fired when Circle / CircleMarker center is placed
  // if source == "Draw" then `workingLayer` is passed else `layer`
  _fireCenterPlaced(source = "Draw", customPayload = {}) {
    const workingLayer = source === "Draw" ? this._layer : void 0;
    const layer = source !== "Draw" ? this._layer : void 0;
    this.__fire(
      this._layer,
      "pm:centerplaced",
      {
        shape: this._shape,
        workingLayer,
        layer,
        latlng: this._layer.getLatLng(),
        oldLatLng: this._layer.getLatLng()
      },
      source,
      customPayload
    );
  },
  // Fired when layer is cutted
  // TODO: is Cut "Draw" or "Edit"? The event `pm:edit` in the same scope is called as source "Edit"
  _fireCut(fireLayer, layer, originalLayer, source = "Draw", customPayload = {}) {
    this.__fire(
      fireLayer,
      "pm:cut",
      {
        shape: this._shape,
        layer,
        originalLayer
      },
      source,
      customPayload
    );
  },
  // Edit Events
  // Fired when layer is edited / changed
  _fireEdit(fireLayer = this._layer, source = "Edit", customPayload = {}) {
    this.__fire(
      fireLayer,
      "pm:edit",
      { layer: this._layer, shape: this.getShape() },
      source,
      customPayload
    );
  },
  // Fired when layer is enabled for editing
  _fireEnable(source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:enable",
      { layer: this._layer, shape: this.getShape() },
      source,
      customPayload
    );
  },
  // Fired when layer is disabled for editing
  _fireDisable(source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:disable",
      { layer: this._layer, shape: this.getShape() },
      source,
      customPayload
    );
  },
  // Fired when layer is disabled and was edited / changed
  _fireUpdate(source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:update",
      { layer: this._layer, shape: this.getShape() },
      source,
      customPayload
    );
  },
  // Fired when a vertex-marker is started dragging
  // indexPath is only passed from Line / Polygon
  _fireMarkerDragStart(e, indexPath = void 0, source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:markerdragstart",
      {
        layer: this._layer,
        markerEvent: e,
        shape: this.getShape(),
        indexPath
      },
      source,
      customPayload
    );
  },
  // Fired while dragging a vertex-marker
  // indexPath is only passed from Line / Polygon
  _fireMarkerDrag(e, indexPath = void 0, source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:markerdrag",
      {
        layer: this._layer,
        markerEvent: e,
        shape: this.getShape(),
        indexPath
      },
      source,
      customPayload
    );
  },
  // Fired when a vertex-marker is stopped dragging
  // indexPath and intersectionReset is only passed from Line / Polygon
  _fireMarkerDragEnd(e, indexPath = void 0, intersectionReset = void 0, source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:markerdragend",
      {
        layer: this._layer,
        markerEvent: e,
        shape: this.getShape(),
        indexPath,
        intersectionReset
      },
      source,
      customPayload
    );
  },
  // Fired when a layer is started dragging
  _fireDragStart(source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:dragstart",
      {
        layer: this._layer,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Fired while dragging a layer
  _fireDrag(e, source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:drag",
      { ...e, shape: this.getShape() },
      source,
      customPayload
    );
  },
  // Fired when a layer is stopped dragging
  _fireDragEnd(source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:dragend",
      {
        layer: this._layer,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Fired when layer is enabled for editing
  _fireDragEnable(source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:dragenable",
      { layer: this._layer, shape: this.getShape() },
      source,
      customPayload
    );
  },
  // Fired when layer is disabled for editing
  _fireDragDisable(source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:dragdisable",
      { layer: this._layer, shape: this.getShape() },
      source,
      customPayload
    );
  },
  // Fired when a layer is removed
  _fireRemove(fireLayer, refLayer = fireLayer, source = "Edit", customPayload = {}) {
    this.__fire(
      fireLayer,
      "pm:remove",
      { layer: refLayer, shape: this.getShape() },
      source,
      customPayload
    );
  },
  // Fired when a vertex-marker is created
  _fireVertexAdded(marker, indexPath, latlng, source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:vertexadded",
      {
        layer: this._layer,
        workingLayer: this._layer,
        marker,
        indexPath,
        latlng,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Fired when a vertex-marker is removed
  _fireVertexRemoved(marker, indexPath, source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:vertexremoved",
      {
        layer: this._layer,
        marker,
        indexPath,
        shape: this.getShape()
        // TODO: maybe add latlng as well?
      },
      source,
      customPayload
    );
  },
  // Fired when a vertex-marker is clicked
  _fireVertexClick(e, indexPath, source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:vertexclick",
      {
        layer: this._layer,
        markerEvent: e,
        indexPath,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Fired when a Line / Polygon has self intersection
  _fireIntersect(intersection, fireLayer = this._layer, source = "Edit", customPayload = {}) {
    this.__fire(
      fireLayer,
      "pm:intersect",
      {
        layer: this._layer,
        intersection,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Fired when a Line / Polygon is reset because of self intersection
  _fireLayerReset(e, indexPath, source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:layerreset",
      {
        layer: this._layer,
        markerEvent: e,
        indexPath,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Fired coordinates of the layer changed
  _fireChange(latlngs, source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:change",
      {
        layer: this._layer,
        latlngs,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Fired when text of a text layer changed
  _fireTextChange(text, source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:textchange",
      {
        layer: this._layer,
        text,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Fired when text layer focused
  _fireTextFocus(source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:textfocus",
      {
        layer: this._layer,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Fired when text layer blurred
  _fireTextBlur(source = "Edit", customPayload = {}) {
    this.__fire(
      this._layer,
      "pm:textblur",
      {
        layer: this._layer,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Snapping Events
  // Fired during a marker move/drag and other layers are existing
  _fireSnapDrag(fireLayer, eventInfo, source = "Snapping", customPayload = {}) {
    this.__fire(fireLayer, "pm:snapdrag", eventInfo, source, customPayload);
  },
  // Fired when a vertex is snapped
  _fireSnap(fireLayer, eventInfo, source = "Snapping", customPayload = {}) {
    this.__fire(fireLayer, "pm:snap", eventInfo, source, customPayload);
  },
  // Fired when a vertex is unsnapped
  _fireUnsnap(fireLayer, eventInfo, source = "Snapping", customPayload = {}) {
    this.__fire(fireLayer, "pm:unsnap", eventInfo, source, customPayload);
  },
  // Rotation Events
  // Fired when rotation is enabled
  _fireRotationEnable(fireLayer, helpLayer, source = "Rotation", customPayload = {}) {
    this.__fire(
      fireLayer,
      "pm:rotateenable",
      {
        layer: this._layer,
        helpLayer: this._rotatePoly,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Fired when rotation is disabled
  _fireRotationDisable(fireLayer, source = "Rotation", customPayload = {}) {
    this.__fire(
      fireLayer,
      "pm:rotatedisable",
      {
        layer: this._layer,
        shape: this.getShape()
      },
      source,
      customPayload
    );
  },
  // Fired when rotation starts
  _fireRotationStart(fireLayer, originLatLngs, source = "Rotation", customPayload = {}) {
    this.__fire(
      fireLayer,
      "pm:rotatestart",
      {
        layer: this._rotationLayer,
        helpLayer: this._layer,
        startAngle: this._startAngle,
        originLatLngs
      },
      source,
      customPayload
    );
  },
  // Fired while rotation
  _fireRotation(fireLayer, angleDiff, oldLatLngs, rotationLayer = this._rotationLayer, source = "Rotation", customPayload = {}) {
    this.__fire(
      fireLayer,
      "pm:rotate",
      {
        layer: rotationLayer,
        helpLayer: this._layer,
        startAngle: this._startAngle,
        angle: rotationLayer.pm.getAngle(),
        angleDiff,
        oldLatLngs,
        newLatLngs: rotationLayer.getLatLngs()
      },
      source,
      customPayload
    );
  },
  // Fired when rotation ends
  _fireRotationEnd(fireLayer, startAngle, originLatLngs, source = "Rotation", customPayload = {}) {
    this.__fire(
      fireLayer,
      "pm:rotateend",
      {
        layer: this._rotationLayer,
        helpLayer: this._layer,
        startAngle,
        angle: this._rotationLayer.pm.getAngle(),
        originLatLngs,
        newLatLngs: this._rotationLayer.getLatLngs()
      },
      source,
      customPayload
    );
  },
  // Global Events
  // Fired when a Toolbar action is clicked
  _fireActionClick(action, btnName, button, source = "Toolbar", customPayload = {}) {
    this.__fire(
      this._map,
      "pm:actionclick",
      {
        text: action.text,
        action,
        btnName,
        button
      },
      source,
      customPayload
    );
  },
  // Fired when a Toolbar button is clicked
  _fireButtonClick(btnName, button, source = "Toolbar", customPayload = {}) {
    this.__fire(
      this._map,
      "pm:buttonclick",
      { btnName, button },
      source,
      customPayload
    );
  },
  // Fired when language is changed
  _fireLangChange(oldLang, activeLang, fallback, translations, source = "Global", customPayload = {}) {
    this.__fire(
      this.map,
      "pm:langchange",
      {
        oldLang,
        activeLang,
        fallback,
        translations
      },
      source,
      customPayload
    );
  },
  // Fired when Drag Mode is toggled.
  _fireGlobalDragModeToggled(enabled, source = "Global", customPayload = {}) {
    this.__fire(
      this.map,
      "pm:globaldragmodetoggled",
      {
        enabled,
        map: this.map
      },
      source,
      customPayload
    );
  },
  // Fired when Edit Mode is toggled.
  _fireGlobalEditModeToggled(enabled, source = "Global", customPayload = {}) {
    this.__fire(
      this.map,
      "pm:globaleditmodetoggled",
      {
        enabled,
        map: this.map
      },
      source,
      customPayload
    );
  },
  // Fired when Removal Mode is toggled.
  _fireGlobalRemovalModeToggled(enabled, source = "Global", customPayload = {}) {
    this.__fire(
      this.map,
      "pm:globalremovalmodetoggled",
      {
        enabled,
        map: this.map
      },
      source,
      customPayload
    );
  },
  // Fired when Cut Mode is toggled.
  _fireGlobalCutModeToggled(source = "Global", customPayload = {}) {
    this.__fire(
      this._map,
      "pm:globalcutmodetoggled",
      {
        enabled: !!this._enabled,
        map: this._map
      },
      source,
      customPayload
    );
  },
  // Fired when Draw Mode is toggled.
  _fireGlobalDrawModeToggled(source = "Global", customPayload = {}) {
    this.__fire(
      this._map,
      "pm:globaldrawmodetoggled",
      {
        enabled: this._enabled,
        shape: this._shape,
        map: this._map
      },
      source,
      customPayload
    );
  },
  // Fired when Rotation Mode is toggled.
  _fireGlobalRotateModeToggled(source = "Global", customPayload = {}) {
    this.__fire(
      this.map,
      "pm:globalrotatemodetoggled",
      {
        enabled: this.globalRotateModeEnabled(),
        map: this.map
      },
      source,
      customPayload
    );
  },
  // Fired when LayerGroup is removed
  _fireRemoveLayerGroup(fireLayer, refLayer = fireLayer, source = "Edit", customPayload = {}) {
    this.__fire(
      fireLayer,
      "pm:remove",
      { layer: refLayer, shape: void 0 },
      source,
      customPayload
    );
  },
  // Fired when `keydown` or `keyup` on the document is fired.
  _fireKeyeventEvent(event, eventType, focusOn, source = "Global", customPayload = {}) {
    this.__fire(
      this.map,
      "pm:keyevent",
      {
        event,
        eventType,
        focusOn
      },
      source,
      customPayload
    );
  },
  // private (very private) fire function
  __fire(fireLayer, type, payload, source, customPayload = {}) {
    payload = merge(payload, customPayload, { source });
    L.PM.Utils._fireEvent(fireLayer, type, payload);
  }
};
var Events_default = EventMixin;

// Keyboard.js
var createKeyboardMixins = () => ({
  _lastEvents: { keydown: void 0, keyup: void 0, current: void 0 },
  _initKeyListener(map) {
    this.map = map;
    L.DomEvent.on(document, "keydown keyup", this._onKeyListener, this);
    L.DomEvent.on(window, "blur", this._onBlur, this);
    map.once("unload", this._unbindKeyListenerEvents, this);
  },
  _unbindKeyListenerEvents() {
    L.DomEvent.off(document, "keydown keyup", this._onKeyListener, this);
    L.DomEvent.off(window, "blur", this._onBlur, this);
  },
  _onKeyListener(e) {
    let focusOn = "document";
    if (this.map.getContainer().contains(e.target)) {
      focusOn = "map";
    }
    const data = { event: e, eventType: e.type, focusOn };
    this._lastEvents[e.type] = data;
    this._lastEvents.current = data;
    this.map.pm._fireKeyeventEvent(e, e.type, focusOn);
  },
  _onBlur(e) {
    e.altKey = false;
    const data = { event: e, eventType: e.type, focusOn: "document" };
    this._lastEvents[e.type] = data;
    this._lastEvents.current = data;
  },
  getLastKeyEvent(type = "current") {
    return this._lastEvents[type];
  },
  isShiftKeyPressed() {
    return this._lastEvents.current?.event.shiftKey;
  },
  isAltKeyPressed() {
    return this._lastEvents.current?.event.altKey;
  },
  isCtrlKeyPressed() {
    return this._lastEvents.current?.event.ctrlKey;
  },
  isMetaKeyPressed() {
    return this._lastEvents.current?.event.metaKey;
  },
  getPressedKey() {
    return this._lastEvents.current?.event.key;
  }
});
var Keyboard_default = createKeyboardMixins;

function getTranslation(path) {
  const lang = L.PM.activeLang;
  return get(translations_default[lang], path) || get(translations_default.en, path) || path;
}
function hasValues(list) {
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (Array.isArray(item)) {
      if (hasValues(item)) {
        return true;
      }
    } else if (item !== null && item !== void 0 && item !== "") {
      return true;
    }
  }
  return false;
}
function removeEmptyCoordRings(arr) {
  return arr.reduce((result, item) => {
    if (item.length !== 0) {
      const newItem = Array.isArray(item) ? removeEmptyCoordRings(item) : item;
      if (Array.isArray(newItem)) {
        if (newItem.length !== 0) {
          result.push(newItem);
        }
      } else {
        result.push(newItem);
      }
    }
    return result;
  }, []);
}
function destinationVincenty(lonlat, brng, dist) {
  const VincentyConstants = {
    a: L.CRS.Earth.R,
    b: 63567523142e-4,
    f: 1 / 298.257223563
  };
  const { a, b, f } = VincentyConstants;
  const lon1 = lonlat.lng;
  const lat1 = lonlat.lat;
  const s = dist;
  const pi = Math.PI;
  const alpha1 = brng * pi / 180;
  const sinAlpha1 = Math.sin(alpha1);
  const cosAlpha1 = Math.cos(alpha1);
  const tanU1 = (1 - f) * Math.tan(
    lat1 * pi / 180
    /* converts lat1 degrees to radius */
  );
  const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1);
  const sinU1 = tanU1 * cosU1;
  const sigma1 = Math.atan2(tanU1, cosAlpha1);
  const sinAlpha = cosU1 * sinAlpha1;
  const cosSqAlpha = 1 - sinAlpha * sinAlpha;
  const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
  const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  let sigma = s / (b * A);
  let sigmaP = 2 * Math.PI;
  let cos2SigmaM;
  let sinSigma;
  let cosSigma;
  while (Math.abs(sigma - sigmaP) > 1e-12) {
    cos2SigmaM = Math.cos(2 * sigma1 + sigma);
    sinSigma = Math.sin(sigma);
    cosSigma = Math.cos(sigma);
    const deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) - B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
    sigmaP = sigma;
    sigma = s / (b * A) + deltaSigma;
  }
  const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
  const lat2 = Math.atan2(
    sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
    (1 - f) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp)
  );
  const lambda = Math.atan2(
    sinSigma * sinAlpha1,
    cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1
  );
  const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
  const lam = lambda - (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  const lamFunc = lon1 + lam * 180 / pi;
  const lat2a = lat2 * 180 / pi;
  return L.latLng(lamFunc, lat2a);
}
function createGeodesicPolygon(origin, radius, sides, rotation, withBearing = true) {
  let trueAngle;
  let newLonlat;
  let geomPoint;
  const points = [];
  for (let i = 0; i < sides; i += 1) {
    if (withBearing) {
      trueAngle = i * 360 / sides + rotation;
      newLonlat = destinationVincenty(origin, trueAngle, radius);
      geomPoint = L.latLng(newLonlat.lng, newLonlat.lat);
    } else {
      const pLat = origin.lat + Math.cos(2 * i * Math.PI / sides) * radius;
      const pLng = origin.lng + Math.sin(2 * i * Math.PI / sides) * radius;
      geomPoint = L.latLng(pLat, pLng);
    }
    points.push(geomPoint);
  }
  return points;
}
function destination(latlng, heading, distance) {
  heading = (heading + 360) % 360;
  const rad = Math.PI / 180;
  const radInv = 180 / Math.PI;
  const { R } = L.CRS.Earth;
  const lon1 = latlng.lng * rad;
  const lat1 = latlng.lat * rad;
  const rheading = heading * rad;
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const cosDistR = Math.cos(distance / R);
  const sinDistR = Math.sin(distance / R);
  const lat2 = Math.asin(
    sinLat1 * cosDistR + cosLat1 * sinDistR * Math.cos(rheading)
  );
  let lon2 = lon1 + Math.atan2(
    Math.sin(rheading) * sinDistR * cosLat1,
    cosDistR - sinLat1 * Math.sin(lat2)
  );
  lon2 *= radInv;
  const optA = lon2 - 360;
  const optB = lon2 < -180 ? lon2 + 360 : lon2;
  lon2 = lon2 > 180 ? optA : optB;
  return L.latLng([lat2 * radInv, lon2]);
}
function calcAngle(map, latlngA, latlngB) {
  const pointA = map.latLngToContainerPoint(latlngA);
  const pointB = map.latLngToContainerPoint(latlngB);
  let angleDeg = Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x) * 180 / Math.PI + 90;
  angleDeg += angleDeg < 0 ? 360 : 0;
  return angleDeg;
}
function destinationOnLine(map, latlngA, latlngB, distance) {
  const angleDeg = calcAngle(map, latlngA, latlngB);
  return destination(latlngA, angleDeg, distance);
}
function prioritiseSort(key, _sortingOrder, order = "asc") {
  if (!_sortingOrder || Object.keys(_sortingOrder).length === 0) {
    return (a, b) => a - b;
  }
  const keys = Object.keys(_sortingOrder);
  let objKey;
  let n = keys.length - 1;
  const sortingOrder = {};
  while (n >= 0) {
    objKey = keys[n];
    sortingOrder[objKey.toLowerCase()] = _sortingOrder[objKey];
    n -= 1;
  }
  function getShape(layer) {
    if (layer instanceof L.Marker) {
      return "Marker";
    }
    if (layer instanceof L.Circle) {
      return "Circle";
    }
    if (layer instanceof L.CircleMarker) {
      return "CircleMarker";
    }
    if (layer instanceof L.Rectangle) {
      return "Rectangle";
    }
    if (layer instanceof L.Polygon) {
      return "Polygon";
    }
    if (layer instanceof L.Polyline) {
      return "Line";
    }
    return void 0;
  }
  return (a, b) => {
    let keyA;
    let keyB;
    if (key === "instanceofShape") {
      keyA = getShape(a.layer).toLowerCase();
      keyB = getShape(b.layer).toLowerCase();
      if (!keyA || !keyB)
        return 0;
    } else {
      if (!Object.prototype.hasOwnProperty.call(a, key) || !Object.prototype.hasOwnProperty.call(b, key))
        return 0;
      keyA = a[key].toLowerCase();
      keyB = b[key].toLowerCase();
    }
    const first = keyA in sortingOrder ? sortingOrder[keyA] : Number.MAX_SAFE_INTEGER;
    const second = keyB in sortingOrder ? sortingOrder[keyB] : Number.MAX_SAFE_INTEGER;
    let result = 0;
    if (first < second)
      result = -1;
    else if (first > second)
      result = 1;
    return order === "desc" ? result * -1 : result;
  };
}
function copyLatLngs(layer, latlngs = layer.getLatLngs()) {
  if (layer instanceof L.Polygon) {
    return L.polygon(latlngs).getLatLngs();
  }
  return L.polyline(latlngs).getLatLngs();
}
function fixLatOffset(latlng, map) {
  if (map.options.crs?.projection?.MAX_LATITUDE) {
    const max = map.options.crs?.projection?.MAX_LATITUDE;
    latlng.lat = Math.max(Math.min(max, latlng.lat), -max);
  }
  return latlng;
}
function getRenderer(layer) {
  return layer.options.renderer || layer._map && (layer._map._getPaneRenderer(layer.options.pane) || layer._map.options.renderer || layer._map._renderer) || layer._renderer;
}
function revertEditLayer(layer) {
  if (layer?.idLayer) {
    if (layer instanceof L.Polyline) {
      layer.setLatLngs(layer._oldLatLng);
    }
    if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.CircleMarker) {
      layer.setLatLng(layer._oldLatLng);
    }
    if (layer instanceof L.Circle || layer instanceof L.CircleMarker) {
      layer.setRadius(layer._oldRadius);
    }
    layer.pm.disable()
    layer = null;
  }
  return true;
}
function saveEditLater(layer) {
  if (layer?.idLayer) {
    if (layer instanceof L.Polyline) {
      layer._oldLatLng = layer.getLatLngs();
    }
    if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.CircleMarker) {
      layer._oldLatLng = layer.getLatLng();
    }
    if (layer instanceof L.Circle || layer instanceof L.CircleMarker) {
      layer._oldRadius = layer.getRadius();
    }
    layer.pm.disable()
    layer = null;
  }
}
var Map = L.Class.extend({
  includes: [
    Mode_Edit_default,
    Mode_Drag_default,
    Mode_Removal_default,
    Mode_Rotate_default,
    Events_default
  ],
  initialize(map) {
    this.map = map;
    this.Draw = new L.PM.Draw(map);
    this.Toolbar = new L.PM.Toolbar(map);
    this.Keyboard = Keyboard_default();
    this.globalOptions = {
      snappable: true,
      layerGroup: void 0,
      snappingOrder: [
        "Marker",
        "CircleMarker",
        "Circle",
        "Line",
        "Polygon",
        "Rectangle",
        "Wireframe"
      ],
      panes: {
        vertexPane: "markerPane",
        layerPane: "overlayPane",
        markerPane: "markerPane"
      },
      draggable: true
    };
    this.Keyboard._initKeyListener(map);
  },
  // eslint-disable-next-line default-param-last
  setLang(lang = "en", override, fallback = "en") {
    lang = lang.trim().toLowerCase();
    if (/^[a-z]{2}$/.test(lang)) { /* empty */ } else {
      const normalizedLang = lang.replace(/[-_\s]/g, "-").replace(/^(\w{2})$/, "$1-");
      const match = normalizedLang.match(/([a-z]{2})-?([a-z]{2})?/);
      if (match) {
        const potentialKeys = [
          `${match[1]}_${match[2]}`,
          // e.g., 'fr_BR'
          `${match[1]}`
          // e.g., 'fr'
        ];
        for (const key of potentialKeys) {
          if (translations_default[key]) {
            lang = key;
            break;
          }
        }
      }
    }
    const oldLang = L.PM.activeLang;
    if (override) {
      translations_default[lang] = merge(translations_default[fallback], override);
    }
    L.PM.activeLang = lang;
    this.map.pm.Toolbar.reinit();
    this._fireLangChange(oldLang, lang, fallback, translations_default[lang]);
  },
  addControls(options) {
    this.Toolbar.addControls(options);
  },
  removeControls() {
    this.Toolbar.removeControls();
  },
  toggleControls() {
    this.Toolbar.toggleControls();
  },
  controlsVisible() {
    return this.Toolbar.isVisible;
  },
  // eslint-disable-next-line default-param-last
  enableDraw(shape = "Polygon", options) {
    if (shape === "Poly") {
      shape = "Polygon";
    }
    this.Draw.enable(shape, options);
  },
  disableDraw(shape = "Polygon") {
    if (shape === "Poly") {
      shape = "Polygon";
    }
    this.Draw.disable(shape);
  },
  // optionsModifier for special options like ignoreShapes or merge
  setPathOptions(options, optionsModifier = {}) {
    const ignore = optionsModifier.ignoreShapes || [];
    const mergeOptions = optionsModifier.merge || false;
    this.map.pm.Draw.shapes.forEach((shape) => {
      if (ignore.indexOf(shape) === -1) {
        this.map.pm.Draw[shape].setPathOptions(options, mergeOptions);
      }
    });
  },
  getGlobalOptions() {
    return this.globalOptions;
  },
  setGlobalOptions(o) {
    const options = merge(this.globalOptions, o);
    if (options.editable) {
      options.resizeableCircleMarker = options.editable;
      delete options.editable;
    }
    let reenableCircleMarker = false;
    if (this.map.pm.Draw.CircleMarker.enabled() && !!this.map.pm.Draw.CircleMarker.options.resizeableCircleMarker !== !!options.resizeableCircleMarker) {
      this.map.pm.Draw.CircleMarker.disable();
      reenableCircleMarker = true;
    }
    let reenableCircle = false;
    if (this.map.pm.Draw.Circle.enabled() && !!this.map.pm.Draw.Circle.options.resizeableCircle !== !!options.resizeableCircle) {
      this.map.pm.Draw.Circle.disable();
      reenableCircle = true;
    }
    this.map.pm.Draw.shapes.forEach((shape) => {
      this.map.pm.Draw[shape].setOptions(options);
    });
    if (reenableCircleMarker) {
      this.map.pm.Draw.CircleMarker.enable();
    }
    if (reenableCircle) {
      this.map.pm.Draw.Circle.enable();
    }
    const layers = L.PM.Utils.findLayers(this.map);
    layers.forEach((layer) => {
      layer.pm.setOptions(options);
    });
    this.map.fire("pm:globaloptionschanged");
    this.globalOptions = options;
    this.applyGlobalOptions();
  },
  applyGlobalOptions() {
    const layers = L.PM.Utils.findLayers(this.map);
    layers.forEach((layer) => {
      if (layer.pm.enabled()) {
        layer.pm.applyOptions();
      }
    });
  },
  globalDrawModeEnabled() {
    return !!this.Draw.getActiveShape();
  },
  globalCutModeEnabled() {
    return !!this.Draw.Cut.enabled();
  },
  enableGlobalCutMode(options) {
    return this.Draw.Cut.enable(options);
  },
  toggleGlobalCutMode(options) {
    return this.Draw.Cut.toggle(options);
  },
  disableGlobalCutMode() {
    return this.Draw.Cut.disable();
  },
  getGeomanLayers(asGroup = false) {
    const layers = L.PM.Utils.findLayers(this.map);
    if (!asGroup) {
      return layers;
    }
    const group = L.featureGroup();
    group._pmTempLayer = true;
    layers.forEach((layer) => {
      group.addLayer(layer);
    });
    return group;
  },
  getGeomanDrawLayers(asGroup = false) {
    const layers = L.PM.Utils.findLayers(this.map).filter(
      (l) => l._drawnByGeoman === true
    );
    if (!asGroup) {
      return layers;
    }
    const group = L.featureGroup();
    group._pmTempLayer = true;
    layers.forEach((layer) => {
      group.addLayer(layer);
    });
    return group;
  },
  // returns the map instance by default or a layergroup is set through global options
  _getContainingLayer() {
    return this.globalOptions.layerGroup && this.globalOptions.layerGroup instanceof L.LayerGroup ? this.globalOptions.layerGroup : this.map;
  },
  _isCRSSimple() {
    return this.map.options.crs === L.CRS.Simple;
  },
  // in Canvas mode we need to convert touch- and pointerevents (IE) to mouseevents, because Leaflet don't support them.
  _touchEventCounter: 0,
  _addTouchEvents(elm) {
    if (this._touchEventCounter === 0) {
      L.DomEvent.on(elm, "touchmove", this._canvasTouchMove, this);
      L.DomEvent.on(
        elm,
        "touchstart touchend touchcancel",
        this._canvasTouchClick,
        this
      );
    }
    this._touchEventCounter += 1;
  },
  _removeTouchEvents(elm) {
    if (this._touchEventCounter === 1) {
      L.DomEvent.off(elm, "touchmove", this._canvasTouchMove, this);
      L.DomEvent.off(
        elm,
        "touchstart touchend touchcancel",
        this._canvasTouchClick,
        this
      );
    }
    this._touchEventCounter = this._touchEventCounter <= 1 ? 0 : this._touchEventCounter - 1;
  },
  _canvasTouchMove(e) {
    getRenderer(this.map)._onMouseMove(this._createMouseEvent("mousemove", e));
  },
  _canvasTouchClick(e) {
    let type = "";
    if (e.type === "touchstart" || e.type === "pointerdown") {
      type = "mousedown";
    } else if (e.type === "touchend" || e.type === "pointerup") {
      type = "mouseup";
    } else if (e.type === "touchcancel" || e.type === "pointercancel") {
      type = "mouseup";
    }
    if (!type) {
      return;
    }
    getRenderer(this.map)._onClick(this._createMouseEvent(type, e));
  },
  _createMouseEvent(type, e) {
    let mouseEvent;
    const touchEvt = e.touches[0] || e.changedTouches[0];
    try {
      mouseEvent = new MouseEvent(type, {
        bubbles: e.bubbles,
        cancelable: e.cancelable,
        view: e.view,
        detail: touchEvt.detail,
        screenX: touchEvt.screenX,
        screenY: touchEvt.screenY,
        clientX: touchEvt.clientX,
        clientY: touchEvt.clientY,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        button: e.button,
        relatedTarget: e.relatedTarget
      });
      // eslint-disable-next-line no-unused-vars
    } catch (ex) {
      mouseEvent = document.createEvent("MouseEvents");
      mouseEvent.initMouseEvent(
        type,
        e.bubbles,
        e.cancelable,
        e.view,
        touchEvt.detail,
        touchEvt.screenX,
        touchEvt.screenY,
        touchEvt.clientX,
        touchEvt.clientY,
        e.ctrlKey,
        e.altKey,
        e.shiftKey,
        e.metaKey,
        e.button,
        e.relatedTarget
      );
    }
    return mouseEvent;
  }
});
var L_PM_Map_default = Map;

// L.Controls.js
var PMButton = L.Control.extend({
  includes: [Events_default],
  options: {
    position: "topleft",
    disableByOtherButtons: true
  },
  // TODO: clean up variable names like _button should be _options and that domNodeVariable stuff
  initialize(options) {
    this._button = L.Util.extend({}, this.options, options);
  },
  onAdd(map) {
    this._map = map;
    if (!this._map.pm.Toolbar.options.oneBlock) {
      if (this._button.tool === "edit") {
        this._container = this._map.pm.Toolbar.editContainer;
      } else if (this._button.tool === "options") {
        this._container = this._map.pm.Toolbar.optionsContainer;
      } else if (this._button.tool === "custom") {
        this._container = this._map.pm.Toolbar.customContainer;
      } else {
        this._container = this._map.pm.Toolbar.drawContainer;
      }
    } else {
      this._container = this._map.pm.Toolbar._createContainer(
        this.options.position
      );
    }
    this._renderButton();
    return this._container;
  },
  _renderButton() {
    const oldDomNode = this.buttonsDomNode;
    this.buttonsDomNode = this._makeButton(this._button);
    if (oldDomNode) {
      oldDomNode.replaceWith(this.buttonsDomNode);
    } else {
      this._container.appendChild(this.buttonsDomNode);
    }
  },
  onRemove() {
    this.buttonsDomNode.remove();
    return this._container;
  },
  getText() {
    return this._button.text;
  },
  getIconUrl() {
    return this._button.iconUrl;
  },
  destroy() {
    this._button = {};
    this._update();
  },
  toggle(e) {
    if (typeof e === "boolean") {
      this._button.toggleStatus = e;
    } else {
      this._button.toggleStatus = !this._button.toggleStatus;
    }
    this._applyStyleClasses();
    return this._button.toggleStatus;
  },
  toggled() {
    return this._button.toggleStatus;
  },
  onCreate() {
    this.toggle(false);
  },
  disable() {
    this.toggle(false);
    this._button.disabled = true;
    this._updateDisabled();
  },
  enable() {
    this._button.disabled = false;
    this._updateDisabled();
  },
  _triggerClick(e) {
    if (e) {
      e.preventDefault();
    }
    if (this._button.disabled) {
      return;
    }
    this._button.onClick(e, { button: this, event: e });
    this._clicked(e);
    this._button.afterClick(e, { button: this, event: e });
  },
  _makeButton(button) {
    const pos = this.options.position.indexOf("right") > -1 ? "pos-right" : "";
    const buttonContainer = L.DomUtil.create(
      "div",
      `button-container  ${pos}`,
      this._container
    );
    if (button.title) {
      buttonContainer.setAttribute("title", button.title);
    }
    const newButton = L.DomUtil.create(
      "a",
      "leaflet-buttons-control-button",
      buttonContainer
    );
    newButton.setAttribute("role", "button");
    newButton.setAttribute("tabindex", "0");
    newButton.href = "#";
    const actionContainer = L.DomUtil.create(
      "div",
      `leaflet-pm-actions-container ${pos}`,
      buttonContainer
    );
    const activeActions = button.actions;
    const actions = {
      cancel: {
        text: getTranslation("actions.cancel"),
        title: getTranslation("actions.cancel"),
        onClick() {
          this._triggerClick();
        }
      },
      finishEdit: {
        text: getTranslation("actions.finish"),
        title: getTranslation("actions.finish"),
        onClick() {
          if (this._map.pm?.layerEdit?.idLayer) {
            saveEditLater(this._map.pm.layerEdit)
          }
          this._triggerClick();
        }
      },
      removeLastVertex: {
        text: getTranslation("actions.removeLastVertex"),
        title: getTranslation("actions.removeLastVertex"),
        onClick() {
          this._map.pm.Draw[button.jsClass]._removeLastVertex();
        }
      },
      cancelEdit: {
        text: getTranslation("actions.cancel"),
        title: getTranslation("actions.cancel"),
        onClick() {
          if (this._map.pm?.layerEdit?.idLayer) {
            revertEditLayer(this._map.pm.layerEdit)
          }
          this._triggerClick();
        }
      },
      finish: {
        text: getTranslation("actions.finish"),
        title: getTranslation("actions.finish"),
        onClick(e) {
          this._map.pm.Draw[button.jsClass]._finishShape(e);
        }
      }
    };
    activeActions.forEach((_action) => {
      const name = typeof _action === "string" ? _action : _action.name;
      let action;
      if (actions[name]) {
        action = actions[name];
      } else if (_action.text) {
        action = _action;
      } else {
        return;
      }
      const actionNode = L.DomUtil.create(
        "a",
        `leaflet-pm-action ${pos} action-${name}`,
        actionContainer
      );
      actionNode.setAttribute("role", "button");
      actionNode.setAttribute("tabindex", "0");
      actionNode.href = "#";
      if (action.title) {
        actionNode.title = action.title;
      }
      actionNode.innerHTML = action.text;
      L.DomEvent.disableClickPropagation(actionNode);
      L.DomEvent.on(actionNode, "click", L.DomEvent.stop);
      if (!button.disabled) {
        if (action.onClick) {
          const actionClick = (e) => {
            e.preventDefault();
            let btnName = "";
            const { buttons } = this._map.pm.Toolbar;
            for (const btn in buttons) {
              if (buttons[btn]._button === button) {
                btnName = btn;
                break;
              }
            }
            this._fireActionClick(action, btnName, button);
          };
          L.DomEvent.addListener(actionNode, "click", actionClick, this);
          L.DomEvent.addListener(actionNode, "click", action.onClick, this);
        }
      }
    });
    if (button.toggleStatus) {
      L.DomUtil.addClass(buttonContainer, "active");
    }
    const image = L.DomUtil.create("div", "control-icon", newButton);
    if (button.iconUrl) {
      image.setAttribute("src", button.iconUrl);
    }
    if (button.className) {
      L.DomUtil.addClass(image, button.className);
    }
    L.DomEvent.disableClickPropagation(newButton);
    L.DomEvent.on(newButton, "click", L.DomEvent.stop);
    if (!button.disabled) {
      L.DomEvent.addListener(newButton, "click", this._onBtnClick, this);
      L.DomEvent.addListener(newButton, "click", this._triggerClick, this);
    }
    if (button.disabled) {
      L.DomUtil.addClass(newButton, "pm-disabled");
      newButton.setAttribute("aria-disabled", "true");
    }
    return buttonContainer;
  },
  _applyStyleClasses() {
    if (!this._container) {
      return;
    }
    if (!this._button.toggleStatus || this._button.cssToggle === false) {
      L.DomUtil.removeClass(this.buttonsDomNode, "active");
      L.DomUtil.removeClass(this._container, "activeChild");
    } else {
      L.DomUtil.addClass(this.buttonsDomNode, "active");
      L.DomUtil.addClass(this._container, "activeChild");
    }
  },
  _onBtnClick() {
    if (this._button.disabled) {
      return;
    }
    if (this._button.disableOtherButtons) {
      this._map.pm.Toolbar.triggerClickOnToggledButtons(this);
    }
    let btnName = "";
    const { buttons } = this._map.pm.Toolbar;
    for (const btn in buttons) {
      if (buttons[btn]._button === this._button) {
        btnName = btn;
        break;
      }
    }
    this._fireButtonClick(btnName, this._button);
  },
  _clicked() {
    if (this._button.doToggle) {
      this.toggle();
    }
  },
  _updateDisabled() {
    if (!this._container) {
      return;
    }
    const className = "pm-disabled";
    const button = this.buttonsDomNode.children[0];
    if (this._button.disabled) {
      L.DomUtil.addClass(button, className);
      button.setAttribute("aria-disabled", "true");
    } else {
      L.DomUtil.removeClass(button, className);
      button.setAttribute("aria-disabled", "false");
    }
  }
});
var L_Controls_default = PMButton;

// L.PM.Toolbar.js
L.Control.PMButton = L_Controls_default;
var Toolbar = L.Class.extend({
  options: {
    drawMarker: true,
    drawRectangle: true,
    drawPolyline: true,
    drawPolygon: true,
    drawCircle: true,
    drawCircleMarker: true,
    drawText: true,
    editMode: true,
    dragMode: true,
    cutPolygon: true,
    removalMode: true,
    rotateMode: true,
    snappingOption: true,
    drawControls: true,
    editControls: true,
    optionsControls: true,
    customControls: true,
    oneBlock: false,
    position: "topleft",
    positions: {
      draw: "",
      edit: "",
      options: "",
      custom: ""
    }
  },
  customButtons: [],
  initialize(map) {
    this.customButtons = [];
    this.options.positions = {
      draw: "",
      edit: "",
      options: "",
      custom: ""
    };
    this.init(map);
  },
  reinit() {
    const addControls = this.isVisible;
    this.removeControls();
    this._defineButtons();
    if (addControls) {
      this.addControls();
    }
  },
  init(map) {
    this.map = map;
    this.buttons = {};
    this.isVisible = false;
    this.drawContainer = L.DomUtil.create(
      "div",
      "leaflet-pm-toolbar leaflet-pm-draw leaflet-bar leaflet-control"
    );
    this.editContainer = L.DomUtil.create(
      "div",
      "leaflet-pm-toolbar leaflet-pm-edit leaflet-bar leaflet-control"
    );
    this.optionsContainer = L.DomUtil.create(
      "div",
      "leaflet-pm-toolbar leaflet-pm-options leaflet-bar leaflet-control"
    );
    this.customContainer = L.DomUtil.create(
      "div",
      "leaflet-pm-toolbar leaflet-pm-custom leaflet-bar leaflet-control"
    );
    this._defineButtons();
  },
  _createContainer(name) {
    const container = `${name}Container`;
    if (!this[container]) {
      this[container] = L.DomUtil.create(
        "div",
        `leaflet-pm-toolbar leaflet-pm-${name} leaflet-bar leaflet-control`
      );
    }
    return this[container];
  },
  getButtons() {
    return this.buttons;
  },
  addControls(options = this.options) {
    if (typeof options.editPolygon !== "undefined") {
      options.editMode = options.editPolygon;
    }
    if (typeof options.deleteLayer !== "undefined") {
      options.removalMode = options.deleteLayer;
    }
    L.Util.setOptions(this, options);
    this.applyIconStyle();
    this.isVisible = true;
    this._showHideButtons();
  },
  applyIconStyle() {
    const buttons = this.getButtons();
    const iconClasses = {
      geomanIcons: {
        drawMarker: "control-icon leaflet-pm-icon-marker",
        drawPolyline: "control-icon leaflet-pm-icon-polyline",
        drawRectangle: "control-icon leaflet-pm-icon-rectangle",
        drawPolygon: "control-icon leaflet-pm-icon-polygon",
        drawCircle: "control-icon leaflet-pm-icon-circle",
        drawCircleMarker: "control-icon leaflet-pm-icon-circle-marker",
        editMode: "control-icon leaflet-pm-icon-edit",
        dragMode: "control-icon leaflet-pm-icon-drag",
        cutPolygon: "control-icon leaflet-pm-icon-cut",
        removalMode: "control-icon leaflet-pm-icon-delete",
        drawText: "control-icon leaflet-pm-icon-text"
      }
    };
    for (const name in buttons) {
      const button = buttons[name];
      L.Util.setOptions(button, {
        className: iconClasses.geomanIcons[name]
      });
    }
  },
  removeControls() {
    const buttons = this.getButtons();
    for (const btn in buttons) {
      buttons[btn].remove();
    }
    this.isVisible = false;
  },
  toggleControls(options = this.options) {
    if (this.isVisible) {
      this.removeControls();
    } else {
      this.addControls(options);
    }
  },
  _addButton(name, button) {
    this.buttons[name] = button;
    this.options[name] = !!this.options[name] || false;
    return this.buttons[name];
  },
  triggerClickOnToggledButtons(exceptThisButton) {
    for (const name in this.buttons) {
      const button = this.buttons[name];
      if (button._button.disableByOtherButtons && button !== exceptThisButton && button.toggled()) {
        button._triggerClick();
      }
    }
  },
  toggleButton(name, status, disableOthers = true) {
    if (name === "editPolygon") {
      name = "editMode";
    }
    if (name === "deleteLayer") {
      name = "removalMode";
    }
    if (disableOthers) {
      this.triggerClickOnToggledButtons(this.buttons[name]);
    }
    if (!this.buttons[name]) {
      return false;
    }
    return this.buttons[name].toggle(status);
  },
  _defineButtons() {
    const drawMarkerButton = {
      className: "control-icon leaflet-pm-icon-marker",
      title: getTranslation("buttonTitles.drawMarkerButton"),
      jsClass: "Marker",
      onClick: () => {
      },
      afterClick: (e, ctx) => {
        this.map.pm.Draw[ctx.button._button.jsClass].toggle();
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      actions: ["cancel"]
    };
    const drawPolyButton = {
      title: getTranslation("buttonTitles.drawPolyButton"),
      className: "control-icon leaflet-pm-icon-polygon",
      jsClass: "Polygon",
      onClick: () => {
      },
      afterClick: (e, ctx) => {
        this.map.pm.Draw[ctx.button._button.jsClass].toggle();
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      actions: ["finish", "removeLastVertex", "cancel"]
    };
    const drawLineButton = {
      className: "control-icon leaflet-pm-icon-polyline",
      title: getTranslation("buttonTitles.drawLineButton"),
      jsClass: "Line",
      onClick: () => {
      },
      afterClick: (e, ctx) => {
        this.map.pm.Draw[ctx.button._button.jsClass].toggle();
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      actions: ["finish", "removeLastVertex", "cancel"]
    };
    const drawCircleButton = {
      title: getTranslation("buttonTitles.drawCircleButton"),
      className: "control-icon leaflet-pm-icon-circle",
      jsClass: "Circle",
      onClick: () => {
      },
      afterClick: (e, ctx) => {
        this.map.pm.Draw[ctx.button._button.jsClass].toggle();
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      actions: ["cancel"]
    };
    const drawCircleMarkerButton = {
      title: getTranslation("buttonTitles.drawCircleMarkerButton"),
      className: "control-icon leaflet-pm-icon-circle-marker",
      jsClass: "CircleMarker",
      onClick: () => {
      },
      afterClick: (e, ctx) => {
        this.map.pm.Draw[ctx.button._button.jsClass].toggle();
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      actions: ["cancel"]
    };
    const drawRectButton = {
      title: getTranslation("buttonTitles.drawRectButton"),
      className: "control-icon leaflet-pm-icon-rectangle",
      jsClass: "Rectangle",
      onClick: () => {
      },
      afterClick: (e, ctx) => {
        this.map.pm.Draw[ctx.button._button.jsClass].toggle();
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      actions: ["cancel"]
    };
    const editButton = {
      title: getTranslation("buttonTitles.editButton"),
      className: "control-icon leaflet-pm-icon-edit",
      onClick: () => {
      },
      afterClick: () => {
        this.map.pm.toggleGlobalEditMode();
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      tool: "edit",
      actions: ["cancelEdit", "finishEdit"]
    };
    const dragButton = {
      title: getTranslation("buttonTitles.dragButton"),
      className: "control-icon leaflet-pm-icon-drag",
      onClick: () => {
      },
      afterClick: () => {
        this.map.pm.toggleGlobalDragMode();
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      tool: "edit",
      actions: ["cancelEdit", "finishEdit"]
    };
    const cutButton = {
      title: getTranslation("buttonTitles.cutButton"),
      className: "control-icon leaflet-pm-icon-cut",
      jsClass: "Cut",
      onClick: () => {
      },
      afterClick: (e, ctx) => {
        this.map.pm.Draw[ctx.button._button.jsClass].toggle({
          snappable: true,
          cursorMarker: true,
          allowSelfIntersection: false
        });
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      tool: "edit",
      actions: ["finish", "removeLastVertex", "cancel"]
    };
    const deleteButton = {
      title: getTranslation("buttonTitles.deleteButton"),
      className: "control-icon leaflet-pm-icon-delete",
      onClick: () => {
      },
      afterClick: () => {
        this.map.pm.toggleGlobalRemovalMode();
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      tool: "edit",
      actions: ["finishEdit"]
    };
    const rotateButton = {
      title: getTranslation("buttonTitles.rotateButton"),
      className: "control-icon leaflet-pm-icon-rotate",
      onClick: () => {
      },
      afterClick: () => {
        this.map.pm.toggleGlobalRotateMode();
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      tool: "edit",
      actions: ["cancelEdit", "finishEdit"]
    };
    const drawTextButton = {
      className: "control-icon leaflet-pm-icon-text",
      title: getTranslation("buttonTitles.drawTextButton"),
      jsClass: "Text",
      onClick: () => {
      },
      afterClick: (e, ctx) => {
        this.map.pm.Draw[ctx.button._button.jsClass].toggle();
        if (this.map.pm.layerEdit) {
          revertEditLayer(this.map.pm.layerEdit)
        }
      },
      doToggle: true,
      toggleStatus: false,
      disableOtherButtons: true,
      position: this.options.position,
      actions: ["cancel"]
    };
    this._addButton("drawMarker", new L.Control.PMButton(drawMarkerButton));
    this._addButton("drawPolyline", new L.Control.PMButton(drawLineButton));
    this._addButton("drawRectangle", new L.Control.PMButton(drawRectButton));
    this._addButton("drawPolygon", new L.Control.PMButton(drawPolyButton));
    this._addButton("drawCircle", new L.Control.PMButton(drawCircleButton));
    this._addButton(
      "drawCircleMarker",
      new L.Control.PMButton(drawCircleMarkerButton)
    );
    this._addButton("drawText", new L.Control.PMButton(drawTextButton));
    this._addButton("editMode", new L.Control.PMButton(editButton));
    this._addButton("dragMode", new L.Control.PMButton(dragButton));
    this._addButton("cutPolygon", new L.Control.PMButton(cutButton));
    this._addButton("removalMode", new L.Control.PMButton(deleteButton));
    this._addButton("rotateMode", new L.Control.PMButton(rotateButton));
  },
  _showHideButtons() {
    if (!this.isVisible) {
      return;
    }
    this.removeControls();
    this.isVisible = true;
    const buttons = this.getButtons();
    let ignoreBtns = [];
    if (this.options.drawControls === false) {
      ignoreBtns = ignoreBtns.concat(
        Object.keys(buttons).filter((btn) => !buttons[btn]._button.tool)
      );
    }
    if (this.options.editControls === false) {
      ignoreBtns = ignoreBtns.concat(
        Object.keys(buttons).filter(
          (btn) => buttons[btn]._button.tool === "edit"
        )
      );
    }
    if (this.options.optionsControls === false) {
      ignoreBtns = ignoreBtns.concat(
        Object.keys(buttons).filter(
          (btn) => buttons[btn]._button.tool === "options"
        )
      );
    }
    if (this.options.customControls === false) {
      ignoreBtns = ignoreBtns.concat(
        Object.keys(buttons).filter(
          (btn) => buttons[btn]._button.tool === "custom"
        )
      );
    }
    for (const btn in buttons) {
      if (this.options[btn] && ignoreBtns.indexOf(btn) === -1) {
        let block = buttons[btn]._button.tool;
        if (!block) {
          block = "draw";
        }
        buttons[btn].setPosition(this._getBtnPosition(block));
        buttons[btn].addTo(this.map);
      }
    }
  },
  _getBtnPosition(block) {
    return this.options.positions && this.options.positions[block] ? this.options.positions[block] : this.options.position;
  },
  setBlockPosition(block, position) {
    this.options.positions[block] = position;
    this._showHideButtons();
    this.changeControlOrder();
  },
  getBlockPositions() {
    return this.options.positions;
  },
  copyDrawControl(copyInstance, options) {
    if (!options) {
      throw new TypeError("Button has no name");
    } else if (typeof options !== "object") {
      options = { name: options };
    }
    const instance = this._btnNameMapping(copyInstance);
    if (!options.name) {
      throw new TypeError("Button has no name");
    }
    if (this.buttons[options.name]) {
      throw new TypeError("Button with this name already exists");
    }
    const drawInstance = this.map.pm.Draw.createNewDrawInstance(
      options.name,
      instance
    );
    const btn = this.buttons[instance]._button;
    options = { ...btn, ...options };
    const control = this.createCustomControl(options);
    return { drawInstance, control };
  },
  createCustomControl(options) {
    if (!options.name) {
      throw new TypeError("Button has no name");
    }
    if (this.buttons[options.name]) {
      throw new TypeError("Button with this name already exists");
    }
    if (!options.onClick) {
      options.onClick = () => {
      };
    }
    if (!options.afterClick) {
      options.afterClick = () => {
      };
    }
    if (options.toggle !== false) {
      options.toggle = true;
    }
    if (options.block) {
      options.block = options.block.toLowerCase();
    }
    if (!options.block || options.block === "draw") {
      options.block = "";
    }
    if (!options.className) {
      options.className = "control-icon";
    } else if (options.className.indexOf("control-icon") === -1) {
      options.className = `control-icon ${options.className}`;
    }
    const _options = {
      tool: options.block,
      className: options.className,
      title: options.title || "",
      jsClass: options.name,
      onClick: options.onClick,
      afterClick: options.afterClick,
      doToggle: options.toggle,
      toggleStatus: false,
      disableOtherButtons: options.disableOtherButtons ?? true,
      disableByOtherButtons: options.disableByOtherButtons ?? true,
      cssToggle: options.toggle,
      position: this.options.position,
      actions: options.actions || [],
      disabled: !!options.disabled
    };
    if (this.options[options.name] !== false) {
      this.options[options.name] = true;
    }
    const control = this._addButton(
      options.name,
      new L.Control.PMButton(_options)
    );
    this.changeControlOrder();
    return control;
  },
  controlExists(name) {
    return Boolean(this.getButton(name));
  },
  getButton(name) {
    return this.getButtons()[name];
  },
  getButtonsInBlock(name) {
    const buttonsInBlock = {};
    if (name) {
      for (const buttonName in this.getButtons()) {
        const button = this.getButtons()[buttonName];
        if (button._button.tool === name || name === "draw" && !button._button.tool) {
          buttonsInBlock[buttonName] = button;
        }
      }
    }
    return buttonsInBlock;
  },
  changeControlOrder(order = []) {
    const shapeMapping = this._shapeMapping();
    const _order = [];
    order.forEach((shape) => {
      if (shapeMapping[shape]) {
        _order.push(shapeMapping[shape]);
      } else {
        _order.push(shape);
      }
    });
    const buttons = this.getButtons();
    const newbtnorder = {};
    _order.forEach((control) => {
      if (buttons[control]) {
        newbtnorder[control] = buttons[control];
      }
    });
    const drawBtns = Object.keys(buttons).filter(
      (btn) => !buttons[btn]._button.tool
    );
    drawBtns.forEach((btn) => {
      if (_order.indexOf(btn) === -1) {
        newbtnorder[btn] = buttons[btn];
      }
    });
    const editBtns = Object.keys(buttons).filter(
      (btn) => buttons[btn]._button.tool === "edit"
    );
    editBtns.forEach((btn) => {
      if (_order.indexOf(btn) === -1) {
        newbtnorder[btn] = buttons[btn];
      }
    });
    const optionsBtns = Object.keys(buttons).filter(
      (btn) => buttons[btn]._button.tool === "options"
    );
    optionsBtns.forEach((btn) => {
      if (_order.indexOf(btn) === -1) {
        newbtnorder[btn] = buttons[btn];
      }
    });
    const customBtns = Object.keys(buttons).filter(
      (btn) => buttons[btn]._button.tool === "custom"
    );
    customBtns.forEach((btn) => {
      if (_order.indexOf(btn) === -1) {
        newbtnorder[btn] = buttons[btn];
      }
    });
    Object.keys(buttons).forEach((btn) => {
      if (_order.indexOf(btn) === -1) {
        newbtnorder[btn] = buttons[btn];
      }
    });
    this.map.pm.Toolbar.buttons = newbtnorder;
    this._showHideButtons();
  },
  getControlOrder() {
    const buttons = this.getButtons();
    const order = [];
    for (const btn in buttons) {
      order.push(btn);
    }
    return order;
  },
  changeActionsOfControl(name, actions) {
    const btnName = this._btnNameMapping(name);
    if (!btnName) {
      throw new TypeError("No name passed");
    }
    if (!actions) {
      throw new TypeError("No actions passed");
    }
    if (!this.buttons[btnName]) {
      throw new TypeError("Button with this name not exists");
    }
    this.buttons[btnName]._button.actions = actions;
    this.changeControlOrder();
  },
  setButtonDisabled(name, state) {
    const btnName = this._btnNameMapping(name);
    if (state) {
      this.buttons[btnName].disable();
    } else {
      this.buttons[btnName].enable();
    }
  },
  _shapeMapping() {
    return {
      Marker: "drawMarker",
      Circle: "drawCircle",
      Polygon: "drawPolygon",
      Rectangle: "drawRectangle",
      Polyline: "drawPolyline",
      Line: "drawPolyline",
      CircleMarker: "drawCircleMarker",
      Edit: "editMode",
      Drag: "dragMode",
      Cut: "cutPolygon",
      Removal: "removalMode",
      Rotate: "rotateMode",
      Text: "drawText"
    };
  },
  _btnNameMapping(name) {
    const shapeMapping = this._shapeMapping();
    return shapeMapping[name] ? shapeMapping[name] : name;
  }
});
var L_PM_Toolbar_default = Toolbar;

// Snapping.js
var SnapMixin = {
  _initSnappableMarkers() {
    this.options.snapDistance = this.options.snapDistance || 30;
    this.options.snapSegment = this.options.snapSegment === void 0 ? true : this.options.snapSegment;
    this._assignEvents(this._markers);
    this._layer.off("pm:dragstart", this._unsnap, this);
    this._layer.on("pm:dragstart", this._unsnap, this);
  },
  _disableSnapping() {
    this._layer.off("pm:dragstart", this._unsnap, this);
  },
  _assignEvents(markerArr) {
    markerArr.forEach((marker) => {
      if (Array.isArray(marker)) {
        this._assignEvents(marker);
        return;
      }
      marker.off("drag", this._handleSnapping, this);
      marker.on("drag", this._handleSnapping, this);
      marker.off("dragend", this._cleanupSnapping, this);
      marker.on("dragend", this._cleanupSnapping, this);
    });
  },
  _cleanupSnapping(e) {
    if (e) {
      const marker = e.target;
      marker._snapped = false;
    }
    delete this._snapList;
    if (this.throttledList) {
      this._map.off("layeradd", this.throttledList, this);
      this.throttledList = void 0;
    }
    this._map.off("layerremove", this._handleSnapLayerRemoval, this);
    if (this.debugIndicatorLines) {
      this.debugIndicatorLines.forEach((line) => {
        line.remove();
      });
    }
  },
  _handleThrottleSnapping() {
    if (this.throttledList) {
      this._createSnapList();
    }
  },
  _handleSnapping(e) {
    const marker = e.target;
    marker._snapped = false;
    if (!this.throttledList) {
      this.throttledList = L.Util.throttle(
        this._handleThrottleSnapping,
        100,
        this
      );
    }
    if (e?.originalEvent?.altKey || this._map?.pm?.Keyboard.isAltKeyPressed()) {
      return false;
    }
    if (this._snapList === void 0) {
      this._createSnapList();
      this._map.off("layeradd", this.throttledList, this);
      this._map.on("layeradd", this.throttledList, this);
    }
    if (this._snapList.length <= 0) {
      return false;
    }
    const closestLayer = this._calcClosestLayer(
      marker.getLatLng(),
      this._snapList
    );
    if (Object.keys(closestLayer).length === 0) {
      return false;
    }
    const isMarker = closestLayer.layer instanceof L.Marker || closestLayer.layer instanceof L.CircleMarker || !this.options.snapSegment;
    let snapLatLng;
    if (!isMarker) {
      snapLatLng = this._checkPrioritiySnapping(closestLayer);
    } else {
      snapLatLng = closestLayer.latlng;
    }
    const minDistance = this.options.snapDistance;
    const eventInfo = {
      marker,
      shape: this._shape,
      snapLatLng,
      segment: closestLayer.segment,
      layer: this._layer,
      workingLayer: this._layer,
      layerInteractedWith: closestLayer.layer,
      // for lack of a better property name
      distance: closestLayer.distance
    };
    this._fireSnapDrag(eventInfo.marker, eventInfo);
    this._fireSnapDrag(this._layer, eventInfo);
    if (closestLayer.distance < minDistance) {
      if (this._layer?.typeDraw === 'Wireframe') {
        if (closestLayer.layer.typeDraw !== 'Wireframe') {
          this._unsnap(eventInfo);
          marker._snapped = false;
          marker._snapInfo = void 0;
          this._fireUnsnap(eventInfo.marker, eventInfo);
          this._fireUnsnap(this._layer, eventInfo);
          return;
        }
      }
      marker._orgLatLng = marker.getLatLng();
      marker.setLatLng(snapLatLng);
      marker._snapped = true;
      marker._snapInfo = eventInfo;
      const triggerSnap = () => {
        this._snapLatLng = snapLatLng;
        this._fireSnap(marker, eventInfo);
        this._fireSnap(this._layer, eventInfo);
      };
      const a = this._snapLatLng || {};
      const b = snapLatLng || {};
      if (a.lat !== b.lat || a.lng !== b.lng) {
        triggerSnap();
      }
    } else if (this._snapLatLng) {
      this._unsnap(eventInfo);
      marker._snapped = false;
      marker._snapInfo = void 0;
      this._fireUnsnap(eventInfo.marker, eventInfo);
      this._fireUnsnap(this._layer, eventInfo);
    }
    return true;
  },
  _createSnapList() {
    let layers = [];
    const debugIndicatorLines = [];
    const map = this._map;
    map.off("layerremove", this._handleSnapLayerRemoval, this);
    map.on("layerremove", this._handleSnapLayerRemoval, this);
    map.eachLayer((layer) => {
      if ((layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.CircleMarker || layer instanceof L.ImageOverlay) && layer.options.snapIgnore !== true) {
        if (layer.options.snapIgnore === void 0 && (!L.PM.optIn && layer.options.pmIgnore === true || // if optIn is not set and pmIgnore is true, the layer will be ignored
          L.PM.optIn && layer.options.pmIgnore !== false)) {
          return;
        }
        if ((layer instanceof L.Circle || layer instanceof L.CircleMarker) && layer.pm && layer.pm._hiddenPolyCircle) {
          layers.push(layer.pm._hiddenPolyCircle);
        } else if (layer instanceof L.ImageOverlay) {
          layer = L.rectangle(layer.getBounds());
        }
        layers.push(layer);
        const debugLine = L.polyline([], { color: "red", pmIgnore: true });
        debugLine._pmTempLayer = true;
        debugIndicatorLines.push(debugLine);
        if (layer instanceof L.Circle || layer instanceof L.CircleMarker) {
          debugIndicatorLines.push(debugLine);
        }
      }
    });
    layers = layers.filter((layer) => this._layer !== layer);
    layers = layers.filter(
      (layer) => layer._latlng || layer._latlngs && hasValues(layer._latlngs)
    );
    layers = layers.filter((layer) => !layer._pmTempLayer);
    if (this._otherSnapLayers) {
      this._otherSnapLayers.forEach(() => {
        const debugLine = L.polyline([], { color: "red", pmIgnore: true });
        debugLine._pmTempLayer = true;
        debugIndicatorLines.push(debugLine);
      });
      this._snapList = layers.concat(this._otherSnapLayers);
    } else {
      this._snapList = layers;
    }
    this.debugIndicatorLines = debugIndicatorLines;
  },
  _handleSnapLayerRemoval({ layer }) {
    if (!layer._leaflet_id) {
      return;
    }
    const index = this._snapList.findIndex(
      (e) => e._leaflet_id === layer._leaflet_id
    );
    if (index > -1) {
      this._snapList.splice(index, 1);
    }
  },
  _calcClosestLayer(latlng, layers) {
    return this._calcClosestLayers(latlng, layers, 1)[0];
  },
  _calcClosestLayers(latlng, layers, amount = 1) {
    let closestLayers = [];
    let closestLayer = {};
    layers.forEach((layer, index) => {
      if (layer._parentCopy && layer._parentCopy === this._layer) {
        return;
      }
      const results = this._calcLayerDistances(latlng, layer);
      results.distance = Math.floor(results.distance);
      if (this.debugIndicatorLines) {
        if (!this.debugIndicatorLines[index]) {
          const debugLine = L.polyline([], { color: "red", pmIgnore: true });
          debugLine._pmTempLayer = true;
          this.debugIndicatorLines[index] = debugLine;
        }
        this.debugIndicatorLines[index].setLatLngs([latlng, results.latlng]);
      }
      if (amount === 1 && (closestLayer.distance === void 0 || results.distance - 5 <= closestLayer.distance)) {
        if (results.distance + 5 < closestLayer.distance) {
          closestLayers = [];
        }
        closestLayer = results;
        closestLayer.layer = layer;
        closestLayers.push(closestLayer);
      } else if (amount !== 1) {
        closestLayer = {};
        closestLayer = results;
        closestLayer.layer = layer;
        closestLayers.push(closestLayer);
      }
    });
    if (amount !== 1) {
      closestLayers = closestLayers.sort((a, b) => a.distance - b.distance);
    }
    if (amount === -1) {
      amount = closestLayers.length;
    }
    const result = this._getClosestLayerByPriority(closestLayers, amount);
    if (L.Util.isArray(result)) {
      return result;
    }
    return [result];
  },
  _calcLayerDistances(latlng, layer) {
    const map = this._map;
    const isMarker = layer instanceof L.Marker || layer instanceof L.CircleMarker;
    const isPolygon = layer instanceof L.Polygon;
    const P = latlng;
    if (isMarker) {
      const latlngs = layer.getLatLng();
      return {
        latlng: { ...latlngs },
        distance: this._getDistance(map, latlngs, P)
      };
    }
    return this._calcLatLngDistances(P, layer.getLatLngs(), map, isPolygon);
  },
  _calcLatLngDistances(latlng, latlngs, map, closedShape = false) {
    let closestCoord;
    let shortestDistance;
    let closestSegment;
    const loopThroughCoords = (coords) => {
      coords.forEach((coord, index) => {
        if (Array.isArray(coord)) {
          loopThroughCoords(coord);
          return;
        }
        if (this.options.snapSegment) {
          const A = coord;
          let nextIndex;
          if (closedShape) {
            nextIndex = index + 1 === coords.length ? 0 : index + 1;
          } else {
            nextIndex = index + 1 === coords.length ? void 0 : index + 1;
          }
          const B = coords[nextIndex];
          if (B) {
            const distance = this._getDistanceToSegment(map, latlng, A, B);
            if (shortestDistance === void 0 || distance < shortestDistance) {
              shortestDistance = distance;
              closestSegment = [A, B];
            }
          }
        } else {
          const distancePoint = this._getDistance(map, latlng, coord);
          if (shortestDistance === void 0 || distancePoint < shortestDistance) {
            shortestDistance = distancePoint;
            closestCoord = coord;
          }
        }
      });
    };
    loopThroughCoords(latlngs);
    if (this.options.snapSegment) {
      const C = this._getClosestPointOnSegment(
        map,
        latlng,
        closestSegment[0],
        closestSegment[1]
      );
      return {
        latlng: { ...C },
        segment: closestSegment,
        distance: shortestDistance
      };
    }
    return {
      latlng: closestCoord,
      distance: shortestDistance
    };
  },
  _getClosestLayerByPriority(layers, amount = 1) {
    layers = layers.sort((a, b) => a._leaflet_id - b._leaflet_id);
    const shapes = [
      "Marker",
      "CircleMarker",
      "Circle",
      "Line",
      "Polygon",
      "Rectangle"
    ];
    const order = this._map.pm.globalOptions.snappingOrder || [];
    let lastIndex = 0;
    const prioOrder = {};
    order.concat(shapes).forEach((shape) => {
      if (!prioOrder[shape]) {
        lastIndex += 1;
        prioOrder[shape] = lastIndex;
      }
    });
    layers.sort(prioritiseSort("instanceofShape", prioOrder));
    if (amount === 1) {
      return layers[0] || {};
    }
    return layers.slice(0, amount);
  },
  // we got the point we want to snap to (C), but we need to check if a coord of the polygon
  // receives priority over C as the snapping point. Let's check this here
  _checkPrioritiySnapping(closestLayer) {
    const map = this._map;
    const A = closestLayer.segment[0];
    const B = closestLayer.segment[1];
    const C = closestLayer.latlng;
    const distanceAC = this._getDistance(map, A, C);
    const distanceBC = this._getDistance(map, B, C);
    let closestVertexLatLng = distanceAC < distanceBC ? A : B;
    let shortestDistance = distanceAC < distanceBC ? distanceAC : distanceBC;
    if (this.options.snapMiddle) {
      const M = L.PM.Utils.calcMiddleLatLng(map, A, B);
      const distanceMC = this._getDistance(map, M, C);
      if (distanceMC < distanceAC && distanceMC < distanceBC) {
        closestVertexLatLng = M;
        shortestDistance = distanceMC;
      }
    }
    const priorityDistance = this.options.snapDistance;
    let snapLatlng;
    if (shortestDistance < priorityDistance) {
      snapLatlng = closestVertexLatLng;
    } else {
      snapLatlng = C;
    }
    return { ...snapLatlng };
  },
  _unsnap() {
    delete this._snapLatLng;
  },
  _getClosestPointOnSegment(map, latlng, latlngA, latlngB) {
    let maxzoom = map.getMaxZoom();
    if (maxzoom === Infinity) {
      maxzoom = map.getZoom();
    }
    const P = map.project(latlng, maxzoom);
    const A = map.project(latlngA, maxzoom);
    const B = map.project(latlngB, maxzoom);
    const closest = L.LineUtil.closestPointOnSegment(P, A, B);
    return map.unproject(closest, maxzoom);
  },
  _getDistanceToSegment(map, latlng, latlngA, latlngB) {
    const P = map.latLngToLayerPoint(latlng);
    const A = map.latLngToLayerPoint(latlngA);
    const B = map.latLngToLayerPoint(latlngB);
    return L.LineUtil.pointToSegmentDistance(P, A, B);
  },
  _getDistance(map, latlngA, latlngB) {
    return map.latLngToLayerPoint(latlngA).distanceTo(map.latLngToLayerPoint(latlngB));
  }
};
var Snapping_default = SnapMixin;

// L.PM.Draw.js
var merge3 = window.mergeLodash;
var Draw = L.Class.extend({
  includes: [Snapping_default, Events_default],
  options: {
    snappable: true,
    // TODO: next major Release, rename it to allowSnapping
    snapDistance: 20,
    snapMiddle: false,
    allowSelfIntersection: true,
    tooltips: true,
    templineStyle: {},
    hintlineStyle: {
      color: "#3388ff",
      dashArray: "5,5"
    },
    pathOptions: null,
    cursorMarker: true,
    finishOn: null,
    markerStyle: {
      draggable: true,
      icon: L.icon()
    },
    hideMiddleMarkers: false,
    minRadiusCircle: null,
    maxRadiusCircle: null,
    minRadiusCircleMarker: null,
    maxRadiusCircleMarker: null,
    resizeableCircleMarker: false,
    resizeableCircle: true,
    markerEditable: true,
    continueDrawing: false,
    snapSegment: true,
    requireSnapToFinish: false,
    rectangleAngle: 0
  },
  setOptions(options) {
    L.Util.setOptions(this, options);
    this.setStyle(this.options);
  },
  setStyle() {
  },
  getOptions() {
    return this.options;
  },
  initialize(map) {
    const self = this;
    const defaultIcon = new L.Icon.Default();
    defaultIcon.options.tooltipAnchor = [0, 0];
    this.options.markerStyle.icon = defaultIcon;
    this._map = map;
    this.shapes = [
      "Marker",
      "CircleMarker",
      "Line",
      "Polygon",
      "Rectangle",
      "Circle",
      "Cut",
      "Text"
    ];
    this.shapes.forEach((shape) => {
      this[shape] = new L.PM.Draw[shape](this._map);
    });
    this._map.on('pm:create', (e) => {
      const layer = e.layer;
      layer.on('click', () => {
        if (self._map?.pm?._globalEditModeEnabled || self?._map?.pm?._globalDragModeEnabled || self?._map?.pm?._globalRotateModeEnabled) {
          if (layer.idLayer !== self._map.pm?.layerEdit?.idLayer) {
            if (self._map.pm?.layerEdit?.idLayer) {
              revertEditLayer(self._map.pm.layerEdit)
            }
            const options = self._map?.pm?._editOption || {};
            self._map.pm.layerEdit = layer;
            if (self._map.pm?._globalEditModeEnabled) {
              layer.pm.enable(options);
            }
            if (self._map.pm?._globalRotateModeEnabled) {
              layer.pm.enableRotate(options);
            }
            if (self._map.pm?._globalDragModeEnabled) {
              layer.pm.enableLayerDrag(options);
            }
          }
        }
      });
    });
    this.Marker.setOptions({ continueDrawing: true });
    this.CircleMarker.setOptions({ continueDrawing: true });
  },
  setPathOptions(options, mergeOptions = false) {
    if (!mergeOptions) {
      this.options.pathOptions = options;
    } else {
      this.options.pathOptions = (merge3 || window.mergeLodash)(this.options.pathOptions, options);
    }
  },
  getShapes() {
    return this.shapes;
  },
  getShape() {
    return this._shape;
  },
  enable(shape, options) {
    if (!shape) {
      throw new Error(
        `Error: Please pass a shape as a parameter. Possible shapes are: ${this.getShapes().join(
          ","
        )}`
      );
    }
    this.disable();
    this[shape].enable(options);
  },
  disable() {
    this.shapes.forEach((shape) => {
      this[shape].disable();
    });
  },
  addControls() {
    this.shapes.forEach((shape) => {
      this[shape].addButton();
    });
  },
  getActiveShape() {
    let enabledShape;
    this.shapes.forEach((shape) => {
      if (this[shape]._enabled) {
        enabledShape = shape;
      }
    });
    return enabledShape;
  },
  _setGlobalDrawMode() {
    if (this._shape === "Cut") {
      this._fireGlobalCutModeToggled();
    } else {
      this._fireGlobalDrawModeToggled();
    }
    const layers = [];
    this._map.eachLayer((layer) => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.CircleMarker || layer instanceof L.ImageOverlay) {
        if (!layer._pmTempLayer) {
          layers.push(layer);
        }
      }
    });
    if (this._enabled) {
      layers.forEach((layer) => {
        L.PM.Utils.disablePopup(layer);
      });
    } else {
      layers.forEach((layer) => {
        L.PM.Utils.enablePopup(layer);
      });
    }
  },
  createNewDrawInstance(name, jsClass) {
    const instance = this._getShapeFromBtnName(jsClass);
    if (this[name]) {
      throw new TypeError("Draw Type already exists");
    }
    if (!L.PM.Draw[instance]) {
      throw new TypeError(`There is no class L.PM.Draw.${instance}`);
    }
    this[name] = new L.PM.Draw[instance](this._map);
    this[name].toolbarButtonName = name;
    this[name]._shape = name;
    this.shapes.push(name);
    if (this[jsClass]) {
      this[name].setOptions(this[jsClass].options);
    }
    this[name].setOptions(this[name].options);
    return this[name];
  },
  _getShapeFromBtnName(name) {
    const shapeMapping = {
      drawMarker: "Marker",
      drawCircle: "Circle",
      drawPolygon: "Polygon",
      drawPolyline: "Line",
      drawRectangle: "Rectangle",
      drawCircleMarker: "CircleMarker",
      editMode: "Edit",
      dragMode: "Drag",
      cutPolygon: "Cut",
      removalMode: "Removal",
      rotateMode: "Rotate",
      drawText: "Text"
    };
    if (shapeMapping[name]) {
      return shapeMapping[name];
    }
    return this[name] ? this[name]._shape : name;
  },
  _finishLayer(layer) {
    if (layer.pm) {
      layer.pm.setOptions(this.options);
      layer.pm._shape = this._shape;
      layer.pm._map = this._map;
    }
    if (layer instanceof L.Polyline) {
      layer._oldLatLng = layer.getLatLngs();
    }
    if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.CircleMarker) {
      layer._oldLatLng = layer.getLatLng();
    }
    if (layer instanceof L.Circle || layer instanceof L.CircleMarker) {
      layer._oldRadius = layer.getRadius();
    }
    layer.idLayer = uuidv4();
    this._addDrawnLayerProp(layer);
  },
  _addDrawnLayerProp(layer) {
    layer._drawnByGeoman = true;
  },
  _setPane(layer, type) {
    if (type === "layerPane") {
      layer.options.pane = this._map.pm.globalOptions.panes && this._map.pm.globalOptions.panes.layerPane || "overlayPane";
    } else if (type === "vertexPane") {
      layer.options.pane = this._map.pm.globalOptions.panes && this._map.pm.globalOptions.panes.vertexPane || "markerPane";
    } else if (type === "markerPane") {
      layer.options.pane = this._map.pm.globalOptions.panes && this._map.pm.globalOptions.panes.markerPane || "markerPane";
    }
  },
  _isFirstLayer() {
    const map = this._map || this._layer._map;
    return map.pm.getGeomanLayers().length === 0;
  }
});
var L_PM_Draw_default = Draw;

// L.PM.Draw.Marker.js
L_PM_Draw_default.Marker = L_PM_Draw_default.extend({
  initialize(map) {
    this._map = map;
    this._shape = "Marker";
    this.toolbarButtonName = "drawMarker";
  },
  enable(options) {
    L.Util.setOptions(this, options);
    this._enabled = true;
    this._map.getContainer().classList.add("geoman-draw-cursor");
    this._map.on("click", this._createMarker, this);
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, true);
    this._hintMarker = L.marker(
      this._map.getCenter(),
      this.options.markerStyle
    );
    this._setPane(this._hintMarker, "markerPane");
    this._hintMarker._pmTempLayer = true;
    this._hintMarker.addTo(this._map);
    if (this.options.tooltips) {
      this._hintMarker.bindTooltip(getTranslation("tooltips.placeMarker"), {
        permanent: true,
        offset: L.point(0, 10),
        direction: "bottom",
        opacity: 0.8
      }).openTooltip();
    }
    this._layer = this._hintMarker;
    this._map.on("mousemove", this._syncHintMarker, this);
    if (this.options.markerEditable) {
      this._map.eachLayer((layer) => {
        if (this.isRelevantMarker(layer)) {
          layer.pm.enable();
        }
      });
    }
    this._fireDrawStart();
    this._setGlobalDrawMode();
  },
  disable() {
    if (!this._enabled) {
      return;
    }
    this._enabled = false;
    this._map.getContainer().classList.remove("geoman-draw-cursor");
    this._map.off("click", this._createMarker, this);
    this._hintMarker.remove();
    this._map.off("mousemove", this._syncHintMarker, this);
    this._map.eachLayer((layer) => {
      if (this.isRelevantMarker(layer)) {
        layer.pm.disable();
      }
    });
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, false);
    if (this.options.snappable) {
      this._cleanupSnapping();
    }
    this._fireDrawEnd();
    this._setGlobalDrawMode();
  },
  enabled() {
    return this._enabled;
  },
  toggle(options) {
    if (this.enabled()) {
      this.disable();
    } else {
      this.enable(options);
    }
  },
  isRelevantMarker(layer) {
    return layer instanceof L.Marker && layer.pm && !layer._pmTempLayer && !layer.pm._initTextMarker;
  },
  _syncHintMarker(e) {
    this._hintMarker.setLatLng(e.latlng);
    if (this.options.snappable) {
      const fakeDragEvent = e;
      fakeDragEvent.target = this._hintMarker;
      this._handleSnapping(fakeDragEvent);
    }
    this._fireChange(this._hintMarker.getLatLng(), "Draw");
  },
  _createMarker(e) {
    if (!e.latlng) {
      return;
    }
    if (this.options.requireSnapToFinish && !this._hintMarker._snapped && !this._isFirstLayer()) {
      return;
    }
    if (!this._hintMarker._snapped) {
      this._hintMarker.setLatLng(e.latlng);
    }
    const latlng = this._hintMarker.getLatLng();
    const marker = new L.Marker(latlng, this.options.markerStyle);
    this._setPane(marker, "markerPane");
    this._finishLayer(marker);
    if (!marker.pm) {
      marker.options.draggable = false;
    }
    marker.addTo(this._map.pm._getContainingLayer());
    if (marker.pm && this.options.markerEditable) {
      marker.pm.enable();
    } else if (marker.dragging) {
      marker.dragging.disable();
    }
    this._fireCreate(marker);
    this._cleanupSnapping();
    if (!this.options.continueDrawing) {
      this.disable();
    }
  },
  setStyle() {
    if (this.options.markerStyle?.icon) {
      this._hintMarker?.setIcon(this.options.markerStyle.icon);
    }
  }
});

L_PM_Draw_default.Line = L_PM_Draw_default.extend({
  initialize(map) {
    this._map = map;
    this._shape = "Line";
    this.toolbarButtonName = "drawPolyline";
    this._doesSelfIntersect = false;
  },
  enable(options) {
    L.Util.setOptions(this, options);
    this._enabled = true;
    this._markers = [];
    this._layerGroup = new L.FeatureGroup();
    this._layerGroup._pmTempLayer = true;
    this._layerGroup.addTo(this._map);
    this._layer = L.polyline([], {
      ...this.options.templineStyle,
      pmIgnore: false
    });
    this._setPane(this._layer, "layerPane");
    this._layer._pmTempLayer = true;
    this._layerGroup.addLayer(this._layer);
    this._hintline = L.polyline([], this.options.hintlineStyle);
    this._setPane(this._hintline, "layerPane");
    this._hintline._pmTempLayer = true;
    this._layerGroup.addLayer(this._hintline);
    this._hintMarker = L.marker(this._map.getCenter(), {
      interactive: false,
      // always vertex marker below will be triggered from the click event -> _finishShape #911
      zIndexOffset: 100,
      icon: L.divIcon({ className: "marker-icon cursor-marker" })
    });
    this._setPane(this._hintMarker, "vertexPane");
    this._hintMarker._pmTempLayer = true;
    this._layerGroup.addLayer(this._hintMarker);
    if (this.options.cursorMarker) {
      L.DomUtil.addClass(this._hintMarker._icon, "visible");
    }
    if (this.options.tooltips) {
      this._hintMarker.bindTooltip(getTranslation("tooltips.firstVertex"), {
        permanent: true,
        offset: L.point(0, 10),
        direction: "bottom",
        opacity: 0.8
      }).openTooltip();
    }
    this._map.getContainer().classList.add("geoman-draw-cursor");
    this._map.on("click", this._createVertex, this);
    if (this.options.finishOn && this.options.finishOn !== "snap") {
      this._map.on(this.options.finishOn, this._finishShape, this);
    }
    if (this.options.finishOn === "dblclick") {
      this.tempMapDoubleClickZoomState = this._map.doubleClickZoom._enabled;
      if (this.tempMapDoubleClickZoomState) {
        this._map.doubleClickZoom.disable();
      }
    }
    this._map.on("mousemove", this._syncHintMarker, this);
    this._hintMarker.on("move", this._syncHintLine, this);
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, true);
    this._otherSnapLayers = [];
    this.isRed = false;
    this._fireDrawStart();
    this._setGlobalDrawMode();
  },
  disable() {
    if (!this._enabled) {
      return;
    }
    this._enabled = false;
    this._map.getContainer().classList.remove("geoman-draw-cursor");
    this._map.off("click", this._createVertex, this);
    this._map.off("mousemove", this._syncHintMarker, this);
    if (this.options.finishOn && this.options.finishOn !== "snap") {
      this._map.off(this.options.finishOn, this._finishShape, this);
    }
    if (this.tempMapDoubleClickZoomState) {
      this._map.doubleClickZoom.enable();
    }
    this._map.removeLayer(this._layerGroup);
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, false);
    if (this.options.snappable) {
      this._cleanupSnapping();
    }
    this._fireDrawEnd();
    this._setGlobalDrawMode();
  },
  enabled() {
    return this._enabled;
  },
  toggle(options) {
    if (this.enabled()) {
      this.disable();
    } else {
      this.enable(options);
    }
  },
  _syncHintLine() {
    const polyPoints = this._layer.getLatLngs();
    if (polyPoints.length > 0) {
      const lastPolygonPoint = polyPoints[polyPoints.length - 1];
      this._hintline.setLatLngs([
        lastPolygonPoint,
        this._hintMarker.getLatLng()
      ]);
    }
  },
  _syncHintMarker(e) {
    this._hintMarker.setLatLng(e.latlng);
    if (this.options.snappable) {
      const fakeDragEvent = e;
      fakeDragEvent.target = this._hintMarker;
      this._handleSnapping(fakeDragEvent);
    }
    if (!this.options.allowSelfIntersection) {
      this._handleSelfIntersection(true, this._hintMarker.getLatLng());
    }
    const latlngs = this._layer._defaultShape().slice();
    latlngs.push(this._hintMarker.getLatLng());
    this._change(latlngs);
  },
  hasSelfIntersection() {
    const selfIntersection = kinks(this._layer.toGeoJSON(15));
    return selfIntersection.features.length > 0;
  },
  _handleSelfIntersection(addVertex, latlng) {
    const clone = L.polyline(this._layer.getLatLngs());
    if (addVertex) {
      if (!latlng) {
        latlng = this._hintMarker.getLatLng();
      }
      clone.addLatLng(latlng);
    }
    const selfIntersection = kinks(clone.toGeoJSON(15));
    this._doesSelfIntersect = selfIntersection.features.length > 0;
    if (this._doesSelfIntersect) {
      if (!this.isRed) {
        this.isRed = true;
        this._hintline.setStyle({
          color: "#f00000ff"
        });
        this._fireIntersect(selfIntersection, this._map, "Draw");
      }
    } else if (!this._hintline.isEmpty()) {
      this.isRed = false;
      this._hintline.setStyle(this.options.hintlineStyle);
    }
  },
  _createVertex(e) {
    if (!this.options.allowSelfIntersection) {
      this._handleSelfIntersection(true, e.latlng);
      if (this._doesSelfIntersect) {
        return;
      }
    }
    if (!this._hintMarker._snapped) {
      this._hintMarker.setLatLng(e.latlng);
    }
    const latlng = this._hintMarker.getLatLng();
    const latlngs = this._layer.getLatLngs();
    const lastLatLng = latlngs[latlngs.length - 1];
    if (latlng.equals(latlngs[0]) || latlngs.length > 0 && latlng.equals(lastLatLng)) {
      this._finishShape();
      return;
    }
    this._layer._latlngInfo = this._layer._latlngInfo || [];
    this._layer._latlngInfo.push({
      latlng,
      snapInfo: this._hintMarker._snapInfo
    });
    this._layer.addLatLng(latlng);
    const newMarker = this._createMarker(latlng);
    this._setTooltipText();
    this._setHintLineAfterNewVertex(latlng);
    this._fireVertexAdded(newMarker, void 0, latlng, "Draw");
    this._change(this._layer.getLatLngs());
    if (this.options.finishOn === "snap" && this._hintMarker._snapped) {
      this._finishShape(e);
    }
  },
  _setHintLineAfterNewVertex(hintMarkerLatLng) {
    this._hintline.setLatLngs([hintMarkerLatLng, hintMarkerLatLng]);
  },
  _removeLastVertex() {
    const markers = this._markers;
    if (markers.length <= 1) {
      this.disable();
      return;
    }
    let coords = this._layer.getLatLngs();
    const removedMarker = markers[markers.length - 1];
    const { indexPath } = L.PM.Utils.findDeepMarkerIndex(
      markers,
      removedMarker
    );
    markers.pop();
    this._layerGroup.removeLayer(removedMarker);
    const markerPrevious = markers[markers.length - 1];
    const indexMarkerPrev = coords.indexOf(markerPrevious.getLatLng());
    coords = coords.slice(0, indexMarkerPrev + 1);
    this._layer.setLatLngs(coords);
    this._layer._latlngInfo.pop();
    this._syncHintLine();
    this._setTooltipText();
    this._fireVertexRemoved(removedMarker, indexPath, "Draw");
    this._change(this._layer.getLatLngs());
  },
  _finishShape() {
    if (!this.options.allowSelfIntersection) {
      this._handleSelfIntersection(false);
      if (this._doesSelfIntersect) {
        return;
      }
    }
    if (this.options.requireSnapToFinish && !this._hintMarker._snapped && !this._isFirstLayer()) {
      return;
    }
    const coords = this._layer.getLatLngs();
    if (coords.length <= 1) {
      return;
    }
    const polylineLayer = L.polyline(coords, this.options.pathOptions);
    this._setPane(polylineLayer, "layerPane");
    this._finishLayer(polylineLayer);
    polylineLayer.addTo(this._map.pm._getContainingLayer());
    this._fireCreate(polylineLayer);
    if (this.options.snappable) {
      this._cleanupSnapping();
    }
    this.disable();
    if (this.options.continueDrawing) {
      this.enable();
    }
  },
  _createMarker(latlng) {
    const marker = new L.Marker(latlng, {
      draggable: false,
      icon: L.divIcon({ className: "marker-icon" })
    });
    this._setPane(marker, "vertexPane");
    marker._pmTempLayer = true;
    this._layerGroup.addLayer(marker);
    this._markers.push(marker);
    marker.on("click", this._finishShape, this);
    return marker;
  },
  _setTooltipText() {
    const { length } = this._layer.getLatLngs().flat();
    let text = "";
    if (length <= 1) {
      text = getTranslation("tooltips.continueLine");
    } else {
      text = getTranslation("tooltips.finishLine");
    }
    this._hintMarker.setTooltipContent(text);
  },
  _change(latlngs) {
    this._fireChange(latlngs, "Draw");
  },
  setStyle() {
    this._layer?.setStyle(this.options.templineStyle);
    this._hintline?.setStyle(this.options.hintlineStyle);
  }
});

// L.PM.Draw.Polygon.js
L_PM_Draw_default.Polygon = L_PM_Draw_default.Line.extend({
  initialize(map) {
    this._map = map;
    this._shape = "Polygon";
    this.toolbarButtonName = "drawPolygon";
  },
  enable(options) {
    L.PM.Draw.Line.prototype.enable.call(this, options);
    this._layer.pm._shape = "Polygon";
  },
  _createMarker(latlng) {
    const marker = new L.Marker(latlng, {
      draggable: false,
      icon: L.divIcon({ className: "marker-icon" })
    });
    this._setPane(marker, "vertexPane");
    marker._pmTempLayer = true;
    this._layerGroup.addLayer(marker);
    this._markers.push(marker);
    if (this._layer.getLatLngs().flat().length === 1) {
      marker.on("click", this._finishShape, this);
      this._tempSnapLayerIndex = this._otherSnapLayers.push(marker) - 1;
      if (this.options.snappable) {
        this._cleanupSnapping();
      }
    } else {
      marker.on("click", () => 1);
    }
    return marker;
  },
  _setTooltipText() {
    const { length } = this._layer.getLatLngs().flat();
    let text = "";
    if (length <= 2) {
      text = getTranslation("tooltips.continueLine");
    } else {
      text = getTranslation("tooltips.finishPoly");
    }
    this._hintMarker.setTooltipContent(text);
  },
  _finishShape() {
    if (!this.options.allowSelfIntersection) {
      this._handleSelfIntersection(true, this._layer.getLatLngs()[0]);
      if (this._doesSelfIntersect) {
        return;
      }
    }
    if (this.options.requireSnapToFinish && !this._hintMarker._snapped && !this._isFirstLayer()) {
      return;
    }
    const coords = this._layer.getLatLngs();
    if (coords.length <= 2) {
      return;
    }
    const polygonLayer = L.polygon(coords, this.options.pathOptions);
    this._setPane(polygonLayer, "layerPane");
    this._finishLayer(polygonLayer);
    polygonLayer.addTo(this._map.pm._getContainingLayer());
    this._fireCreate(polygonLayer);
    this._cleanupSnapping();
    this._otherSnapLayers.splice(this._tempSnapLayerIndex, 1);
    delete this._tempSnapLayerIndex;
    this.disable();
    if (this.options.continueDrawing) {
      this.enable();
    }
  }
});

// L.PM.Draw.Rectangle.js
L_PM_Draw_default.Rectangle = L_PM_Draw_default.extend({
  initialize(map) {
    this._map = map;
    this._shape = "Rectangle";
    this.toolbarButtonName = "drawRectangle";
  },
  enable(options) {
    L.Util.setOptions(this, options);
    this._enabled = true;
    this._layerGroup = new L.FeatureGroup();
    this._layerGroup._pmTempLayer = true;
    this._layerGroup.addTo(this._map);
    this._layer = L.rectangle(
      [
        [0, 0],
        [0, 0]
      ],
      this.options.pathOptions
    );
    this._setPane(this._layer, "layerPane");
    this._layer._pmTempLayer = true;
    this._startMarker = L.marker(this._map.getCenter(), {
      icon: L.divIcon({ className: "marker-icon rect-start-marker" }),
      draggable: false,
      zIndexOffset: -100,
      opacity: this.options.cursorMarker ? 1 : 0
    });
    this._setPane(this._startMarker, "vertexPane");
    this._startMarker._pmTempLayer = true;
    this._layerGroup.addLayer(this._startMarker);
    this._hintMarker = L.marker(this._map.getCenter(), {
      zIndexOffset: 150,
      icon: L.divIcon({ className: "marker-icon cursor-marker" })
    });
    this._setPane(this._hintMarker, "vertexPane");
    this._hintMarker._pmTempLayer = true;
    this._layerGroup.addLayer(this._hintMarker);
    if (this.options.cursorMarker) {
      L.DomUtil.addClass(this._hintMarker._icon, "visible");
    }
    if (this.options.tooltips) {
      this._hintMarker.bindTooltip(getTranslation("tooltips.firstVertex"), {
        permanent: true,
        offset: L.point(0, 10),
        direction: "bottom",
        opacity: 0.8
      }).openTooltip();
    }
    if (this.options.cursorMarker) {
      this._styleMarkers = [];
      for (let i = 0; i < 2; i += 1) {
        const styleMarker = L.marker(this._map.getCenter(), {
          icon: L.divIcon({
            className: "marker-icon rect-style-marker"
          }),
          draggable: false,
          zIndexOffset: 100
        });
        this._setPane(styleMarker, "vertexPane");
        styleMarker._pmTempLayer = true;
        this._layerGroup.addLayer(styleMarker);
        this._styleMarkers.push(styleMarker);
      }
    }
    this._map.getContainer().classList.add("geoman-draw-cursor");
    this._map.on("click", this._placeStartingMarkers, this);
    this._map.on("mousemove", this._syncHintMarker, this);
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, true);
    this._otherSnapLayers = [];
    this._fireDrawStart();
    this._setGlobalDrawMode();
  },
  disable() {
    if (!this._enabled) {
      return;
    }
    this._enabled = false;
    this._map.getContainer().classList.remove("geoman-draw-cursor");
    this._map.off("click", this._finishShape, this);
    this._map.off("click", this._placeStartingMarkers, this);
    this._map.off("mousemove", this._syncHintMarker, this);
    this._map.removeLayer(this._layerGroup);
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, false);
    if (this.options.snappable) {
      this._cleanupSnapping();
    }
    this._fireDrawEnd();
    this._setGlobalDrawMode();
  },
  enabled() {
    return this._enabled;
  },
  toggle(options) {
    if (this.enabled()) {
      this.disable();
    } else {
      this.enable(options);
    }
  },
  _placeStartingMarkers(e) {
    if (!this._hintMarker._snapped) {
      this._hintMarker.setLatLng(e.latlng);
    }
    const latlng = this._hintMarker.getLatLng();
    L.DomUtil.addClass(this._startMarker._icon, "visible");
    this._startMarker.setLatLng(latlng);
    if (this.options.cursorMarker && this._styleMarkers) {
      this._styleMarkers.forEach((styleMarker) => {
        L.DomUtil.addClass(styleMarker._icon, "visible");
        styleMarker.setLatLng(latlng);
      });
    }
    this._map.off("click", this._placeStartingMarkers, this);
    this._map.on("click", this._finishShape, this);
    this._hintMarker.setTooltipContent(getTranslation("tooltips.finishRect"));
    this._setRectangleOrigin();
  },
  _setRectangleOrigin() {
    const latlng = this._startMarker.getLatLng();
    if (latlng) {
      this._layerGroup.addLayer(this._layer);
      this._layer.setLatLngs([latlng, latlng]);
      this._hintMarker.on("move", this._syncRectangleSize, this);
    }
  },
  _syncHintMarker(e) {
    this._hintMarker.setLatLng(e.latlng);
    if (this.options.snappable) {
      const fakeDragEvent = e;
      fakeDragEvent.target = this._hintMarker;
      this._handleSnapping(fakeDragEvent);
    }
    const latlngs = this._layerGroup && this._layerGroup.hasLayer(this._layer) ? this._layer.getLatLngs() : [this._hintMarker.getLatLng()];
    this._fireChange(latlngs, "Draw");
  },
  _syncRectangleSize() {
    const A = fixLatOffset(this._startMarker.getLatLng(), this._map);
    const B = fixLatOffset(this._hintMarker.getLatLng(), this._map);
    const corners = L.PM.Utils._getRotatedRectangle(
      A,
      B,
      this.options.rectangleAngle || 0,
      this._map
    );
    this._layer.setLatLngs(corners);
    if (this.options.cursorMarker && this._styleMarkers) {
      const unmarkedCorners = [];
      corners.forEach((corner) => {
        if (!corner.equals(A, 1e-8) && !corner.equals(B, 1e-8)) {
          unmarkedCorners.push(corner);
        }
      });
      unmarkedCorners.forEach((unmarkedCorner, index) => {
        try {
          this._styleMarkers[index].setLatLng(unmarkedCorner);
          // eslint-disable-next-line no-unused-vars
        } catch (e) { /* empty */ }
      });
    }
  },
  _findCorners() {
    const latlngs = this._layer.getLatLngs()[0];
    return L.PM.Utils._getRotatedRectangle(
      latlngs[0],
      latlngs[2],
      this.options.rectangleAngle || 0,
      this._map
    );
  },
  _finishShape(e) {
    if (!this._hintMarker._snapped) {
      this._hintMarker.setLatLng(e.latlng);
    }
    const B = this._hintMarker.getLatLng();
    const A = this._startMarker.getLatLng();
    if (this.options.requireSnapToFinish && !this._hintMarker._snapped && !this._isFirstLayer()) {
      return;
    }
    if (A.equals(B)) {
      return;
    }
    const rectangleLayer = L.rectangle([A, B], this.options.pathOptions);
    if (this.options.rectangleAngle) {
      const corners = L.PM.Utils._getRotatedRectangle(
        A,
        B,
        this.options.rectangleAngle || 0,
        this._map
      );
      rectangleLayer.setLatLngs(corners);
      if (rectangleLayer.pm) {
        rectangleLayer.pm._setAngle(this.options.rectangleAngle || 0);
      }
    }
    this._setPane(rectangleLayer, "layerPane");
    this._finishLayer(rectangleLayer);
    rectangleLayer.addTo(this._map.pm._getContainingLayer());
    this._fireCreate(rectangleLayer);
    this.disable();
    if (this.options.continueDrawing) {
      this.enable();
    }
  },
  setStyle() {
    this._layer?.setStyle(this.options.pathOptions);
  }
});

// L.PM.Draw.CircleMarker.js
L_PM_Draw_default.CircleMarker = L_PM_Draw_default.extend({
  initialize(map) {
    this._map = map;
    this._shape = "CircleMarker";
    this.toolbarButtonName = "drawCircleMarker";
    this._layerIsDragging = false;
    this._BaseCircleClass = L.CircleMarker;
    this._minRadiusOption = "minRadiusCircleMarker";
    this._maxRadiusOption = "maxRadiusCircleMarker";
    this._editableOption = "resizeableCircleMarker";
    this._defaultRadius = 10;
  },
  enable(options) {
    L.Util.setOptions(this, options);
    if (this.options.editable) {
      this.options.resizeableCircleMarker = this.options.editable;
      delete this.options.editable;
    }
    this._enabled = true;
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, true);
    this._map.getContainer().classList.add("geoman-draw-cursor");
    if (this.options[this._editableOption]) {
      const templineStyle = {};
      L.extend(templineStyle, this.options.templineStyle);
      templineStyle.radius = 0;
      this._layerGroup = new L.FeatureGroup();
      this._layerGroup._pmTempLayer = true;
      this._layerGroup.addTo(this._map);
      this._layer = new this._BaseCircleClass(
        this._map.getCenter(),
        templineStyle
      );
      this._setPane(this._layer, "layerPane");
      this._layer._pmTempLayer = true;
      this._centerMarker = L.marker(this._map.getCenter(), {
        icon: L.divIcon({ className: "marker-icon" }),
        draggable: false,
        zIndexOffset: 100
      });
      this._setPane(this._centerMarker, "vertexPane");
      this._centerMarker._pmTempLayer = true;
      this._hintMarker = L.marker(this._map.getCenter(), {
        zIndexOffset: 110,
        icon: L.divIcon({ className: "marker-icon cursor-marker" })
      });
      this._setPane(this._hintMarker, "vertexPane");
      this._hintMarker._pmTempLayer = true;
      this._layerGroup.addLayer(this._hintMarker);
      if (this.options.cursorMarker) {
        L.DomUtil.addClass(this._hintMarker._icon, "visible");
      }
      if (this.options.tooltips) {
        this._hintMarker.bindTooltip(getTranslation("tooltips.startCircle"), {
          permanent: true,
          offset: L.point(0, 10),
          direction: "bottom",
          opacity: 0.8
        }).openTooltip();
      }
      this._hintline = L.polyline([], this.options.hintlineStyle);
      this._setPane(this._hintline, "layerPane");
      this._hintline._pmTempLayer = true;
      this._layerGroup.addLayer(this._hintline);
      this._map.on("click", this._placeCenterMarker, this);
    } else {
      this._map.on("click", this._createMarker, this);
      this._hintMarker = new this._BaseCircleClass(this._map.getCenter(), {
        radius: this._defaultRadius,
        ...this.options.templineStyle
      });
      this._setPane(this._hintMarker, "layerPane");
      this._hintMarker._pmTempLayer = true;
      this._hintMarker.addTo(this._map);
      this._layer = this._hintMarker;
      if (this.options.tooltips) {
        this._hintMarker.bindTooltip(getTranslation("tooltips.placeCircleMarker"), {
          permanent: true,
          offset: L.point(0, 10),
          direction: "bottom",
          opacity: 0.8
        }).openTooltip();
      }
    }
    this._map.on("mousemove", this._syncHintMarker, this);
    this._extendingEnable();
    this._otherSnapLayers = [];
    this._fireDrawStart();
    this._setGlobalDrawMode();
  },
  _extendingEnable() {
    if (!this.options[this._editableOption] && this.options.markerEditable) {
      this._map.eachLayer((layer) => {
        if (this.isRelevantMarker(layer)) {
          layer.pm.enable();
        }
      });
    }
    this._layer.bringToBack();
  },
  disable() {
    if (!this._enabled) {
      return;
    }
    this._enabled = false;
    this._map.getContainer().classList.remove("geoman-draw-cursor");
    if (this.options[this._editableOption]) {
      this._map.off("click", this._finishShape, this);
      this._map.off("click", this._placeCenterMarker, this);
      this._map.removeLayer(this._layerGroup);
    } else {
      this._map.off("click", this._createMarker, this);
      this._extendingDisable();
      this._hintMarker.remove();
    }
    this._map.off("mousemove", this._syncHintMarker, this);
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, false);
    if (this.options.snappable) {
      this._cleanupSnapping();
    }
    this._fireDrawEnd();
    this._setGlobalDrawMode();
  },
  _extendingDisable() {
    this._map.eachLayer((layer) => {
      if (this.isRelevantMarker(layer)) {
        layer.pm.disable();
      }
    });
  },
  enabled() {
    return this._enabled;
  },
  toggle(options) {
    if (this.enabled()) {
      this.disable();
    } else {
      this.enable(options);
    }
  },
  _placeCenterMarker(e) {
    this._layerGroup.addLayer(this._layer);
    this._layerGroup.addLayer(this._centerMarker);
    if (!this._hintMarker._snapped) {
      this._hintMarker.setLatLng(e.latlng);
    }
    const latlng = this._hintMarker.getLatLng();
    this._layerGroup.addLayer(this._layer);
    this._centerMarker.setLatLng(latlng);
    this._map.off("click", this._placeCenterMarker, this);
    this._map.on("click", this._finishShape, this);
    this._placeCircleCenter();
  },
  _placeCircleCenter() {
    const latlng = this._centerMarker.getLatLng();
    if (latlng) {
      this._layer.setLatLng(latlng);
      this._hintMarker.on("move", this._syncHintLine, this);
      this._hintMarker.on("move", this._syncCircleRadius, this);
      this._hintMarker.setTooltipContent(
        getTranslation("tooltips.finishCircle")
      );
      this._fireCenterPlaced();
      this._fireChange(this._layer.getLatLng(), "Draw");
    }
  },
  _syncHintLine() {
    const latlng = this._centerMarker.getLatLng();
    const secondLatLng = this._getNewDestinationOfHintMarker();
    this._hintline.setLatLngs([latlng, secondLatLng]);
  },
  _syncCircleRadius() {
    const A = this._centerMarker.getLatLng();
    const B = this._hintMarker.getLatLng();
    const distance = this._distanceCalculation(A, B);
    if (this.options[this._minRadiusOption] && distance < this.options[this._minRadiusOption]) {
      this._layer.setRadius(this.options[this._minRadiusOption]);
    } else if (this.options[this._maxRadiusOption] && distance > this.options[this._maxRadiusOption]) {
      this._layer.setRadius(this.options[this._maxRadiusOption]);
    } else {
      this._layer.setRadius(distance);
    }
  },
  _syncHintMarker(e) {
    this._hintMarker.setLatLng(e.latlng);
    this._hintMarker.setLatLng(this._getNewDestinationOfHintMarker());
    if (this.options.snappable) {
      const fakeDragEvent = e;
      fakeDragEvent.target = this._hintMarker;
      this._handleSnapping(fakeDragEvent);
    }
    this._handleHintMarkerSnapping();
    const latlng = this._layerGroup && this._layerGroup.hasLayer(this._centerMarker) ? this._centerMarker.getLatLng() : this._hintMarker.getLatLng();
    this._fireChange(latlng, "Draw");
  },
  isRelevantMarker(layer) {
    return layer instanceof L.CircleMarker && !(layer instanceof L.Circle) && layer.pm && !layer._pmTempLayer;
  },
  _createMarker(e) {
    if (this.options.requireSnapToFinish && !this._hintMarker._snapped && !this._isFirstLayer()) {
      return;
    }
    if (!e.latlng || this._layerIsDragging) {
      return;
    }
    if (!this._hintMarker._snapped) {
      this._hintMarker.setLatLng(e.latlng);
    }
    const latlng = this._hintMarker.getLatLng();
    const marker = new this._BaseCircleClass(latlng, {
      radius: this._defaultRadius,
      ...this.options.pathOptions
    });
    this._setPane(marker, "layerPane");
    this._finishLayer(marker);
    marker.addTo(this._map.pm._getContainingLayer());
    this._extendingCreateMarker(marker);
    this._fireCreate(marker);
    this._cleanupSnapping();
    if (!this.options.continueDrawing) {
      this.disable();
    }
  },
  _extendingCreateMarker(marker) {
    if (marker.pm && this.options.markerEditable) {
      marker.pm.enable();
    }
  },
  _finishShape(e) {
    if (this.options.requireSnapToFinish && !this._hintMarker._snapped && !this._isFirstLayer()) {
      return;
    }
    if (!this._hintMarker._snapped) {
      this._hintMarker.setLatLng(e.latlng);
    }
    const center = this._centerMarker.getLatLng();
    let radius = this._defaultRadius;
    if (this.options[this._editableOption]) {
      const latlng = this._hintMarker.getLatLng();
      radius = this._distanceCalculation(center, latlng);
      if (this.options[this._minRadiusOption] && radius < this.options[this._minRadiusOption]) {
        radius = this.options[this._minRadiusOption];
      } else if (this.options[this._maxRadiusOption] && radius > this.options[this._maxRadiusOption]) {
        radius = this.options[this._maxRadiusOption];
      }
    }
    const options = { ...this.options.pathOptions, radius };
    const circleLayer = new this._BaseCircleClass(center, options);
    this._setPane(circleLayer, "layerPane");
    this._finishLayer(circleLayer);
    circleLayer.addTo(this._map.pm._getContainingLayer());
    if (circleLayer.pm) {
      circleLayer.pm._updateHiddenPolyCircle();
    }
    this._fireCreate(circleLayer);
    this.disable();
    if (this.options.continueDrawing) {
      this.enable();
    }
  },
  _getNewDestinationOfHintMarker() {
    let secondLatLng = this._hintMarker.getLatLng();
    if (this.options[this._editableOption]) {
      if (!this._layerGroup.hasLayer(this._centerMarker)) {
        return secondLatLng;
      }
      const latlng = this._centerMarker.getLatLng();
      const distance = this._distanceCalculation(latlng, secondLatLng);
      if (this.options[this._minRadiusOption] && distance < this.options[this._minRadiusOption]) {
        secondLatLng = destinationOnLine(
          this._map,
          latlng,
          secondLatLng,
          this._getMinDistanceInMeter()
        );
      } else if (this.options[this._maxRadiusOption] && distance > this.options[this._maxRadiusOption]) {
        secondLatLng = destinationOnLine(
          this._map,
          latlng,
          secondLatLng,
          this._getMaxDistanceInMeter()
        );
      }
    }
    return secondLatLng;
  },
  _getMinDistanceInMeter() {
    return L.PM.Utils.pxRadiusToMeterRadius(
      this.options[this._minRadiusOption],
      this._map,
      this._centerMarker.getLatLng()
    );
  },
  _getMaxDistanceInMeter() {
    return L.PM.Utils.pxRadiusToMeterRadius(
      this.options[this._maxRadiusOption],
      this._map,
      this._centerMarker.getLatLng()
    );
  },
  _handleHintMarkerSnapping() {
    if (this.options[this._editableOption]) {
      if (this._hintMarker._snapped) {
        const latlng = this._centerMarker.getLatLng();
        const secondLatLng = this._hintMarker.getLatLng();
        const distance = this._distanceCalculation(latlng, secondLatLng);
        if (!this._layerGroup.hasLayer(this._centerMarker)) { /* empty */ } else if (this.options[this._minRadiusOption] && distance < this.options[this._minRadiusOption]) {
          this._hintMarker.setLatLng(this._hintMarker._orgLatLng);
        } else if (this.options[this._maxRadiusOption] && distance > this.options[this._maxRadiusOption]) {
          this._hintMarker.setLatLng(this._hintMarker._orgLatLng);
        }
      }
      this._hintMarker.setLatLng(this._getNewDestinationOfHintMarker());
    }
  },
  setStyle() {
    const templineStyle = {};
    L.extend(templineStyle, this.options.templineStyle);
    if (this.options[this._editableOption]) {
      templineStyle.radius = 0;
    }
    this._layer?.setStyle(templineStyle);
    this._hintline?.setStyle(this.options.hintlineStyle);
  },
  _distanceCalculation(A, B) {
    return this._map.project(A).distanceTo(this._map.project(B));
  }
});

// L.PM.Draw.Circle.js
L_PM_Draw_default.Circle = L_PM_Draw_default.CircleMarker.extend({
  initialize(map) {
    this._map = map;
    this._shape = "Circle";
    this.toolbarButtonName = "drawCircle";
    this._BaseCircleClass = L.Circle;
    this._minRadiusOption = "minRadiusCircle";
    this._maxRadiusOption = "maxRadiusCircle";
    this._editableOption = "resizeableCircle";
    this._defaultRadius = 100;
  },
  _extendingEnable() {
  },
  _extendingDisable() {
  },
  _extendingCreateMarker() {
  },
  isRelevantMarker() {
  },
  _getMinDistanceInMeter() {
    return this.options[this._minRadiusOption];
  },
  _getMaxDistanceInMeter() {
    return this.options[this._maxRadiusOption];
  },
  _distanceCalculation(A, B) {
    return this._map.distance(A, B);
  }
});

function feature(geom) {
  const feat = { type: "Feature" };
  feat.geometry = geom;
  return feat;
}
function getGeometry(geojson) {
  if (geojson.type === "Feature")
    return geojson.geometry;
  return geojson;
}
function getCoords(geojson) {
  if (geojson && geojson.geometry && geojson.geometry.coordinates)
    return geojson.geometry.coordinates;
  return geojson;
}
function turfLineString(coords) {
  return feature({ type: "LineString", coordinates: coords });
}
function turfMultiLineString(coords) {
  return feature({ type: "MultiLineString", coordinates: coords });
}
function turfPolygon(coords) {
  return feature({ type: "Polygon", coordinates: coords });
}
function turfMultiPolygon(coords) {
  return feature({ type: "MultiPolygon", coordinates: coords });
}
function intersect(poly1, poly2) {
  const geom1 = getGeometry(poly1);
  const geom2 = getGeometry(poly2);
  const intersection = polygonClipping.intersection(
    geom1.coordinates,
    geom2.coordinates
  );
  if (intersection.length === 0)
    return null;
  if (intersection.length === 1)
    return turfPolygon(intersection[0]);
  return turfMultiPolygon(intersection);
}
function difference(polygon1, polygon2) {
  const geom1 = getGeometry(polygon1);
  const geom2 = getGeometry(polygon2);
  const differenced = polygonClipping.difference(
    geom1.coordinates,
    geom2.coordinates
  );
  if (differenced.length === 0)
    return null;
  if (differenced.length === 1)
    return turfPolygon(differenced[0]);
  return turfMultiPolygon(differenced);
}
function getDepthOfCoords(coords) {
  if (Array.isArray(coords)) {
    return 1 + getDepthOfCoords(coords[0]);
  }
  return -1;
}
function flattenPolyline(polyline) {
  if (polyline instanceof L.Polyline) {
    polyline = polyline.toGeoJSON(15);
  }
  const coords = getCoords(polyline);
  const depth = getDepthOfCoords(coords);
  const features = [];
  if (depth > 1) {
    coords.forEach((coord) => {
      features.push(turfLineString(coord));
    });
  } else {
    features.push(polyline);
  }
  return features;
}
function groupToMultiLineString(group) {
  const coords = [];
  group.eachLayer((layer) => {
    coords.push(getCoords(layer.toGeoJSON(15)));
  });
  return turfMultiLineString(coords);
}

L_PM_Draw_default.Cut = L_PM_Draw_default.Polygon.extend({
  initialize(map) {
    this._map = map;
    this._shape = "Cut";
    this.toolbarButtonName = "cutPolygon";
  },
  _finishShape() {
    this._editedLayers = [];
    if (!this.options.allowSelfIntersection) {
      this._handleSelfIntersection(true, this._layer.getLatLngs()[0]);
      if (this._doesSelfIntersect) {
        return;
      }
    }
    if (this.options.requireSnapToFinish && !this._hintMarker._snapped && !this._isFirstLayer()) {
      return;
    }
    const coords = this._layer.getLatLngs();
    if (coords.length <= 2) {
      return;
    }
    const polygonLayer = L.polygon(coords, this.options.pathOptions);
    polygonLayer._latlngInfos = this._layer._latlngInfo;
    this.cut(polygonLayer);
    this._cleanupSnapping();
    this._otherSnapLayers.splice(this._tempSnapLayerIndex, 1);
    delete this._tempSnapLayerIndex;
    this._editedLayers.forEach(({ layer, originalLayer }) => {
      this._fireCut(originalLayer, layer, originalLayer);
      this._fireCut(this._map, layer, originalLayer);
      originalLayer.pm._fireEdit();
    });
    this._editedLayers = [];
    this.disable();
    if (this.options.continueDrawing) {
      this.enable();
    }
  },
  cut(layer) {
    const all = this._map._layers;
    const _latlngInfos = layer._latlngInfos || [];
    const layers = Object.keys(all).map((l) => all[l]).filter((l) => l.pm).filter((l) => !l._pmTempLayer).filter(
      (l) => !L.PM.optIn && !l.options.pmIgnore || // if optIn is not set / true and pmIgnore is not set / true (default)
        L.PM.optIn && l.options.pmIgnore === false
      // if optIn is true and pmIgnore is false);
    ).filter((l) => l instanceof L.Polyline).filter((l) => l !== layer).filter((l) => l.pm.options.allowCutting).filter((l) => {
      if (this.options.layersToCut && L.Util.isArray(this.options.layersToCut) && this.options.layersToCut.length > 0) {
        return this.options.layersToCut.indexOf(l) > -1;
      }
      return true;
    }).filter((l) => !this._layerGroup.hasLayer(l)).filter((l) => {
      try {
        const lineInter = !!lineIntersect(layer.toGeoJSON(15), l.toGeoJSON(15)).features.length > 0;
        if (lineInter || l instanceof L.Polyline && !(l instanceof L.Polygon)) {
          return lineInter;
        }
        return !!intersect(layer.toGeoJSON(15), l.toGeoJSON(15));
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        if (l instanceof L.Polygon) {
          console.error("You can't cut polygons with self-intersections");
        }
        return false;
      }
    });
    layers.forEach((l) => {
      let newLayer;
      if (l instanceof L.Polygon) {
        newLayer = L.polygon(l.getLatLngs());
        const coords = newLayer.getLatLngs();
        _latlngInfos.forEach((info) => {
          if (info && info.snapInfo) {
            const { latlng } = info;
            const closest = this._calcClosestLayer(latlng, [newLayer]);
            if (closest && closest.segment && closest.distance < this.options.snapDistance) {
              const { segment } = closest;
              if (segment && segment.length === 2) {
                const { indexPath, parentPath, newIndex } = L.PM.Utils._getIndexFromSegment(coords, segment);
                const coordsRing = indexPath.length > 1 ? get(coords, parentPath) : coords;
                coordsRing.splice(newIndex, 0, latlng);
              }
            }
          }
        });
      } else {
        newLayer = l;
      }
      const diff = this._cutLayer(layer, newLayer);
      let resultLayer = L.geoJSON(diff, l.options);
      if (resultLayer.getLayers().length === 1) {
        [resultLayer] = resultLayer.getLayers();
      }
      this._setPane(resultLayer, "layerPane");
      const resultingLayer = resultLayer.addTo(
        this._map.pm._getContainingLayer()
      );
      resultingLayer.pm.enable(l.pm.options);
      resultingLayer.pm.disable();
      l._pmTempLayer = true;
      layer._pmTempLayer = true;
      l.remove();
      l.removeFrom(this._map.pm._getContainingLayer());
      layer.remove();
      layer.removeFrom(this._map.pm._getContainingLayer());
      if (resultingLayer.getLayers && resultingLayer.getLayers().length === 0) {
        this._map.pm.removeLayer({ target: resultingLayer });
      }
      if (resultingLayer instanceof L.LayerGroup) {
        resultingLayer.eachLayer((_layer) => {
          this._addDrawnLayerProp(_layer);
        });
        this._addDrawnLayerProp(resultingLayer);
      } else {
        this._addDrawnLayerProp(resultingLayer);
      }
      if (this.options.layersToCut && L.Util.isArray(this.options.layersToCut) && this.options.layersToCut.length > 0) {
        const idx = this.options.layersToCut.indexOf(l);
        if (idx > -1) {
          this.options.layersToCut.splice(idx, 1);
        }
      }
      this._editedLayers.push({
        layer: resultingLayer,
        originalLayer: l
      });
    });
  },
  _cutLayer(layer, l) {
    const fg = L.geoJSON();
    let diff;
    if (l instanceof L.Polygon) {
      diff = difference(l.toGeoJSON(15), layer.toGeoJSON(15));
    } else {
      const features = flattenPolyline(l);
      features.forEach((feature2) => {
        const lineDiff = lineSplit(feature2, layer.toGeoJSON(15));
        let group;
        if (lineDiff && lineDiff.features.length > 0) {
          group = L.geoJSON(lineDiff);
        } else {
          group = L.geoJSON(feature2);
        }
        group.getLayers().forEach((lay) => {
          if (!booleanContains(layer.toGeoJSON(15), lay.toGeoJSON(15))) {
            lay.addTo(fg);
          }
        });
      });
      if (features.length > 1) {
        diff = groupToMultiLineString(fg);
      } else {
        diff = fg.toGeoJSON(15);
      }
    }
    return diff;
  },
  _change: L.Util.falseFn
});

// L.PM.Draw.Text.js
L_PM_Draw_default.Text = L_PM_Draw_default.extend({
  initialize(map) {
    this._map = map;
    this._shape = "Text";
    this.toolbarButtonName = "drawText";
  },
  enable(options) {
    L.Util.setOptions(this, options);
    this._enabled = true;
    this._map.on("click", this._createMarker, this);
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, true);
    this._hintMarker = L.marker(this._map.getCenter(), {
      interactive: false,
      zIndexOffset: 100,
      icon: L.divIcon({ className: "marker-icon cursor-marker" })
    });
    this._setPane(this._hintMarker, "vertexPane");
    this._hintMarker._pmTempLayer = true;
    this._hintMarker.addTo(this._map);
    if (this.options.cursorMarker) {
      L.DomUtil.addClass(this._hintMarker._icon, "visible");
    }
    if (this.options.tooltips) {
      this._hintMarker.bindTooltip(getTranslation("tooltips.placeText"), {
        permanent: true,
        offset: L.point(0, 10),
        direction: "bottom",
        opacity: 0.8
      }).openTooltip();
    }
    this._layer = this._hintMarker;
    this._map.on("mousemove", this._syncHintMarker, this);
    this._map.getContainer().classList.add("geoman-draw-cursor");
    this._fireDrawStart();
    this._setGlobalDrawMode();
  },
  disable() {
    if (!this._enabled) {
      return;
    }
    this._enabled = false;
    this._map.off("click", this._createMarker, this);
    this._hintMarker?.remove();
    this._map.getContainer().classList.remove("geoman-draw-cursor");
    this._map.off("mousemove", this._syncHintMarker, this);
    this._map.pm.Toolbar.toggleButton(this.toolbarButtonName, false);
    if (this.options.snappable) {
      this._cleanupSnapping();
    }
    this._fireDrawEnd();
    this._setGlobalDrawMode();
  },
  enabled() {
    return this._enabled;
  },
  toggle(options) {
    if (this.enabled()) {
      this.disable();
    } else {
      this.enable(options);
    }
  },
  _syncHintMarker(e) {
    this._hintMarker.setLatLng(e.latlng);
    if (this.options.snappable) {
      const fakeDragEvent = e;
      fakeDragEvent.target = this._hintMarker;
      this._handleSnapping(fakeDragEvent);
    }
  },
  _createMarker(e) {
    if (!e.latlng) {
      return;
    }
    if (this.options.requireSnapToFinish && !this._hintMarker._snapped && !this._isFirstLayer()) {
      return;
    }
    if (!this._hintMarker._snapped) {
      this._hintMarker.setLatLng(e.latlng);
    }
    const latlng = this._hintMarker.getLatLng();
    this.textArea = this._createTextArea();
    if (this.options.textOptions?.className) {
      const cssClasses = this.options.textOptions.className.split(" ");
      this.textArea.classList.add(...cssClasses);
    }
    const textAreaIcon = this._createTextIcon(this.textArea);
    const marker = new L.Marker(latlng, {
      textMarker: true,
      _textMarkerOverPM: true,
      // we need to put this into the options, else we can't catch this in the init method
      icon: textAreaIcon
    });
    this._setPane(marker, "markerPane");
    this._finishLayer(marker);
    if (!marker.pm) {
      marker.options.draggable = false;
    }
    marker.addTo(this._map.pm._getContainingLayer());
    if (marker.pm) {
      marker.pm.textArea = this.textArea;
      L.setOptions(marker.pm, {
        removeIfEmpty: this.options.textOptions?.removeIfEmpty ?? true
      });
      const focusAfterDraw = this.options.textOptions?.focusAfterDraw ?? true;
      marker.pm._createTextMarker(focusAfterDraw);
      if (this.options.textOptions?.text) {
        marker.pm.setText(this.options.textOptions.text);
      }
    }
    this._fireCreate(marker);
    this._cleanupSnapping();
    this.disable();
    if (this.options.continueDrawing) {
      this.enable();
    }
  },
  _createTextArea() {
    const textArea = document.createElement("textarea");
    textArea.readOnly = true;
    textArea.classList.add("pm-textarea", "pm-disabled");
    return textArea;
  },
  _createTextIcon(textArea) {
    return L.divIcon({
      className: "pm-text-marker",
      html: textArea
    });
  }
});

// Dragging.js
var DragMixin = {
  enableLayerDrag() {
    if (!this.options.draggable || !this._layer._map) {
      return;
    }
    this.disable();
    this._layerDragEnabled = true;
    if (!this._map) {
      this._map = this._layer._map;
    }
    if (this._layer instanceof L.Marker || this._layer instanceof L.ImageOverlay) {
      L.DomEvent.on(this._getDOMElem(), "dragstart", this._stopDOMImageDrag);
    }
    if (this._layer.dragging) {
      this._layer.dragging.disable();
    }
    this._tempDragCoord = null;
    if (getRenderer(this._layer) instanceof L.Canvas) {
      this._layer.on("mouseout", this.removeDraggingClass, this);
      this._layer.on("mouseover", this.addDraggingClass, this);
    } else {
      this.addDraggingClass();
    }
    this._originalMapDragState = this._layer._map.dragging._enabled;
    this._safeToCacheDragState = true;
    const container = this._getDOMElem();
    if (container) {
      if (getRenderer(this._layer) instanceof L.Canvas) {
        this._layer.on(
          "touchstart mousedown",
          this._dragMixinOnMouseDown,
          this
        );
        this._map.pm._addTouchEvents(container);
      } else {
        L.DomEvent.on(
          container,
          "touchstart mousedown",
          this._simulateMouseDownEvent,
          this
        );
      }
    }
    this._fireDragEnable();
  },
  disableLayerDrag() {
    this._layerDragEnabled = false;
    if (getRenderer(this._layer) instanceof L.Canvas) {
      this._layer.off("mouseout", this.removeDraggingClass, this);
      this._layer.off("mouseover", this.addDraggingClass, this);
    } else {
      this.removeDraggingClass();
    }
    if (this._originalMapDragState && this._dragging) {
      this._map.dragging.enable();
    }
    this._safeToCacheDragState = false;
    if (this._layer.dragging) {
      this._layer.dragging.disable();
    }
    const container = this._getDOMElem();
    if (container) {
      if (getRenderer(this._layer) instanceof L.Canvas) {
        this._layer.off(
          "touchstart mousedown",
          this._dragMixinOnMouseDown,
          this
        );
        this._map.pm._removeTouchEvents(container);
      } else {
        L.DomEvent.off(
          container,
          "touchstart mousedown",
          this._simulateMouseDownEvent,
          this
        );
      }
    }
    if (this._layerDragged) {
      this._fireUpdate();
    }
    this._layerDragged = false;
    this._fireDragDisable();
  },
  // TODO: make this private in the next major release
  dragging() {
    return this._dragging;
  },
  layerDragEnabled() {
    return !!this._layerDragEnabled;
  },
  // We need to simulate a mousedown event on the layer object. We can't just use layer.on('mousedown') because on touch devices the event is not fired if user presses on the layer and then drag it.
  // With checking on touchstart and mousedown on the DOM element we can listen on the needed events
  _simulateMouseDownEvent(e) {
    const first = e.touches ? e.touches[0] : e;
    const evt = {
      originalEvent: first,
      target: this._layer
    };
    evt.containerPoint = this._map.mouseEventToContainerPoint(first);
    evt.latlng = this._map.containerPointToLatLng(evt.containerPoint);
    this._dragMixinOnMouseDown(evt);
    return false;
  },
  _simulateMouseMoveEvent(e) {
    const first = e.touches ? e.touches[0] : e;
    const evt = {
      originalEvent: first,
      target: this._layer
    };
    evt.containerPoint = this._map.mouseEventToContainerPoint(first);
    evt.latlng = this._map.containerPointToLatLng(evt.containerPoint);
    this._dragMixinOnMouseMove(evt);
    return false;
  },
  _simulateMouseUpEvent(e) {
    const first = e.touches ? e.touches[0] : e;
    const evt = {
      originalEvent: first,
      target: this._layer
    };
    if (e.type.indexOf("touch") === -1) {
      evt.containerPoint = this._map.mouseEventToContainerPoint(e);
      evt.latlng = this._map.containerPointToLatLng(evt.containerPoint);
    }
    this._dragMixinOnMouseUp(evt);
    return false;
  },
  _dragMixinOnMouseDown(e) {
    if (e.originalEvent.button > 0) {
      return;
    }
    this._overwriteEventIfItComesFromMarker(e);
    const fromLayerSync = e._fromLayerSync;
    const layersToSyncFound = this._syncLayers("_dragMixinOnMouseDown", e);
    if (this._layer instanceof L.Marker) {
      if (this.options.snappable && !fromLayerSync && !layersToSyncFound) {
        this._initSnappableMarkers();
      } else {
        this._disableSnapping();
      }
    }
    if (this._layer instanceof L.CircleMarker) {
      let _editableOption = "resizeableCircleMarker";
      if (this._layer instanceof L.Circle) {
        _editableOption = "resizeableCircle";
      }
      if (this.options.snappable && !fromLayerSync && !layersToSyncFound) {
        if (!this._layer.pm.options[_editableOption]) {
          this._initSnappableMarkersDrag();
        }
      } else if (this._layer.pm.options[_editableOption]) {
        this._layer.pm._disableSnapping();
      } else {
        this._layer.pm._disableSnappingDrag();
      }
    }
    if (this._safeToCacheDragState) {
      this._originalMapDragState = this._layer._map.dragging._enabled;
      this._safeToCacheDragState = false;
    }
    this._tempDragCoord = e.latlng;
    L.DomEvent.on(
      this._map.getContainer(),
      "touchend mouseup",
      this._simulateMouseUpEvent,
      this
    );
    L.DomEvent.on(
      this._map.getContainer(),
      "touchmove mousemove",
      this._simulateMouseMoveEvent,
      this
    );
  },
  _dragMixinOnMouseMove(e) {
    this._overwriteEventIfItComesFromMarker(e);
    const el = this._getDOMElem();
    this._syncLayers("_dragMixinOnMouseMove", e);
    if (!this._dragging) {
      this._dragging = true;
      L.DomUtil.addClass(el, "leaflet-pm-dragging");
      if (!(this._layer instanceof L.Marker)) {
        this._layer.bringToFront();
      }
      if (this._originalMapDragState) {
        this._map.dragging.disable();
      }
      this._fireDragStart();
    }
    if (!this._tempDragCoord) {
      this._tempDragCoord = e.latlng;
    }
    this._onLayerDrag(e);
    if (this._layer instanceof L.CircleMarker) {
      this._layer.pm._updateHiddenPolyCircle();
    }
  },
  _dragMixinOnMouseUp(e) {
    const el = this._getDOMElem();
    this._syncLayers("_dragMixinOnMouseUp", e);
    if (this._originalMapDragState) {
      this._map.dragging.enable();
    }
    this._safeToCacheDragState = true;
    L.DomEvent.off(
      this._map.getContainer(),
      "touchmove mousemove",
      this._simulateMouseMoveEvent,
      this
    );
    L.DomEvent.off(
      this._map.getContainer(),
      "touchend mouseup",
      this._simulateMouseUpEvent,
      this
    );
    if (!this._dragging) {
      return false;
    }
    if (this._layer instanceof L.CircleMarker) {
      this._layer.pm._updateHiddenPolyCircle();
    }
    this._layerDragged = true;
    window.setTimeout(() => {
      this._dragging = false;
      if (el) {
        L.DomUtil.removeClass(el, "leaflet-pm-dragging");
      }
      this._fireDragEnd();
      this._fireEdit();
      this._layerEdited = true;
    }, 10);
    return true;
  },
  _onLayerDrag(e) {
    const { latlng } = e;
    const deltaLatLng = {
      lat: latlng.lat - this._tempDragCoord.lat,
      lng: latlng.lng - this._tempDragCoord.lng
    };
    const moveCoords = (coords) => (
      // alter the coordinates
      coords.map((currentLatLng) => {
        if (Array.isArray(currentLatLng)) {
          return moveCoords(currentLatLng);
        }
        const newLatlng = {
          lat: currentLatLng.lat + deltaLatLng.lat,
          lng: currentLatLng.lng + deltaLatLng.lng
        };
        if (currentLatLng.alt || currentLatLng.alt === 0) {
          newLatlng.alt = currentLatLng.alt;
        }
        return newLatlng;
      })
    );
    if (this._layer instanceof L.Circle && this._layer.options.resizeableCircle || this._layer instanceof L.CircleMarker && this._layer.options.resizeableCircleMarker) {
      const newCoords = moveCoords([this._layer.getLatLng()]);
      this._layer.setLatLng(newCoords[0]);
      this._fireChange(this._layer.getLatLng(), "Edit");
    } else if (this._layer instanceof L.CircleMarker || this._layer instanceof L.Marker) {
      let coordsRefernce = this._layer.getLatLng();
      if (this._layer._snapped) {
        coordsRefernce = this._layer._orgLatLng;
      }
      const newCoords = moveCoords([coordsRefernce]);
      this._layer.setLatLng(newCoords[0]);
      this._fireChange(this._layer.getLatLng(), "Edit");
    } else if (this._layer instanceof L.ImageOverlay) {
      const newCoords = moveCoords([
        this._layer.getBounds().getNorthWest(),
        this._layer.getBounds().getSouthEast()
      ]);
      this._layer.setBounds(newCoords);
      this._fireChange(this._layer.getBounds(), "Edit");
    } else {
      const newCoords = moveCoords(this._layer.getLatLngs());
      this._layer.setLatLngs(newCoords);
      this._fireChange(this._layer.getLatLngs(), "Edit");
    }
    this._tempDragCoord = latlng;
    e.layer = this._layer;
    this._fireDrag(e);
  },
  addDraggingClass() {
    const el = this._getDOMElem();
    if (el) {
      L.DomUtil.addClass(el, "leaflet-pm-draggable");
    }
  },
  removeDraggingClass() {
    const el = this._getDOMElem();
    if (el) {
      L.DomUtil.removeClass(el, "leaflet-pm-draggable");
    }
  },
  _getDOMElem() {
    let el = null;
    if (this._layer._path) {
      el = this._layer._path;
    } else if (this._layer._renderer && this._layer._renderer._container) {
      el = this._layer._renderer._container;
    } else if (this._layer._image) {
      el = this._layer._image;
    } else if (this._layer._icon) {
      el = this._layer._icon;
    }
    return el;
  },
  _overwriteEventIfItComesFromMarker(e) {
    const isMarker = e.target.getLatLng && (!e.target._radius || e.target._radius <= 10);
    if (isMarker) {
      e.containerPoint = this._map.mouseEventToContainerPoint(e.originalEvent);
      e.latlng = this._map.containerPointToLatLng(e.containerPoint);
    }
  },
  _syncLayers(fnc, e) {
    if (this.enabled()) {
      return false;
    }
    if (!e._fromLayerSync && this._layer === e.target && this.options.syncLayersOnDrag) {
      e._fromLayerSync = true;
      let layersToSync = [];
      if (L.Util.isArray(this.options.syncLayersOnDrag)) {
        layersToSync = this.options.syncLayersOnDrag;
        this.options.syncLayersOnDrag.forEach((layer) => {
          if (layer instanceof L.LayerGroup) {
            layersToSync = layersToSync.concat(layer.pm.getLayers(true));
          }
        });
      } else if (this.options.syncLayersOnDrag === true) {
        if (this._parentLayerGroup) {
          for (const key in this._parentLayerGroup) {
            const lg = this._parentLayerGroup[key];
            if (lg.pm) {
              layersToSync = lg.pm.getLayers(true);
            }
          }
        }
      }
      if (L.Util.isArray(layersToSync) && layersToSync.length > 0) {
        layersToSync = layersToSync.filter((layer) => !!layer.pm).filter((layer) => !!layer.pm.options.draggable);
        layersToSync.forEach((layer) => {
          if (layer !== this._layer && layer.pm[fnc]) {
            layer._snapped = false;
            layer.pm[fnc](e);
          }
        });
      }
      return layersToSync.length > 0;
    }
    return false;
  },
  _stopDOMImageDrag(e) {
    e.preventDefault();
    return false;
  }
};
var Dragging_default = DragMixin;

// ModeHelper.js
function _convertLatLng(latlng, matrix, map, zoom) {
  return map.unproject(matrix.transform(map.project(latlng, zoom)), zoom);
}
function _convertLatLngs(latlng, matrix, map) {
  let zoom = map.getMaxZoom();
  if (zoom === Infinity) {
    zoom = map.getZoom();
  }
  if (L.Util.isArray(latlng)) {
    const latlngs = [];
    latlng.forEach((x) => {
      latlngs.push(_convertLatLngs(x, matrix, map));
    });
    return latlngs;
  }
  if (latlng instanceof L.LatLng) {
    return _convertLatLng(latlng, matrix, map, zoom);
  }
  return null;
}
function _toPoint(map, latlng) {
  if (latlng instanceof L.Layer) {
    latlng = latlng.getLatLng();
  }
  let zoom = map.getMaxZoom();
  if (zoom === Infinity) {
    zoom = map.getZoom();
  }
  return map.project(latlng, zoom);
}
function _toLatLng(map, point) {
  let zoom = map.getMaxZoom();
  if (zoom === Infinity) {
    zoom = map.getZoom();
  }
  return map.unproject(point, zoom);
}

var RotateMixin = {
  _onRotateStart(e) {
    this._preventRenderingMarkers(true);
    this._rotationOriginLatLng = this._getRotationCenter().clone();
    this._rotationOriginPoint = _toPoint(this._map, this._rotationOriginLatLng);
    this._rotationStartPoint = _toPoint(this._map, e.target.getLatLng());
    this._initialRotateLatLng = copyLatLngs(this._layer);
    this._startAngle = this.getAngle();
    const originLatLngs = copyLatLngs(
      this._rotationLayer,
      this._rotationLayer.pm._rotateOrgLatLng
    );
    this._fireRotationStart(this._rotationLayer, originLatLngs);
    this._fireRotationStart(this._map, originLatLngs);
  },
  _onRotate(e) {
    const position = _toPoint(this._map, e.target.getLatLng());
    const previous = this._rotationStartPoint;
    const origin = this._rotationOriginPoint;
    const angleDiffRadiant = Math.atan2(position.y - origin.y, position.x - origin.x) - Math.atan2(previous.y - origin.y, previous.x - origin.x);
    this._layer.setLatLngs(
      this._rotateLayer(
        angleDiffRadiant,
        this._initialRotateLatLng,
        this._rotationOriginLatLng,
        L.PM.Matrix.init(),
        this._map
      )
    );
    const that = this;
    function forEachLatLng(latlng, path = [], _i = -1) {
      if (_i > -1) {
        path.push(_i);
      }
      if (L.Util.isArray(latlng[0])) {
        latlng.forEach((x, i) => forEachLatLng(x, path.slice(), i));
      } else {
        const markers = get(that._markers, path);
        latlng.forEach((_latlng, j) => {
          const marker = markers[j];
          marker.setLatLng(_latlng);
        });
      }
    }
    forEachLatLng(this._layer.getLatLngs());
    const oldLatLngs = copyLatLngs(this._rotationLayer);
    this._rotationLayer.setLatLngs(
      this._rotateLayer(
        angleDiffRadiant,
        this._rotationLayer.pm._rotateOrgLatLng,
        this._rotationOriginLatLng,
        L.PM.Matrix.init(),
        this._map
      )
    );
    let angleDiff = angleDiffRadiant * 180 / Math.PI;
    angleDiff = angleDiff < 0 ? angleDiff + 360 : angleDiff;
    const angle = angleDiff + this._startAngle;
    this._setAngle(angle);
    this._rotationLayer.pm._setAngle(angle);
    this._fireRotation(this._rotationLayer, angleDiff, oldLatLngs);
    this._fireRotation(this._map, angleDiff, oldLatLngs);
    this._rotationLayer.pm._fireChange(
      this._rotationLayer.getLatLngs(),
      "Rotation"
    );
  },
  _onRotateEnd() {
    const startAngle = this._startAngle;
    delete this._rotationOriginLatLng;
    delete this._rotationOriginPoint;
    delete this._rotationStartPoint;
    delete this._initialRotateLatLng;
    delete this._startAngle;
    const originLatLngs = copyLatLngs(
      this._rotationLayer,
      this._rotationLayer.pm._rotateOrgLatLng
    );
    this._rotationLayer.pm._rotateOrgLatLng = copyLatLngs(this._rotationLayer);
    this._fireRotationEnd(this._rotationLayer, startAngle, originLatLngs);
    this._fireRotationEnd(this._map, startAngle, originLatLngs);
    this._rotationLayer.pm._fireEdit(this._rotationLayer, "Rotation");
    this._preventRenderingMarkers(false);
    this._layerRotated = true;
  },
  _rotateLayer(radiant, latlngs, origin, _matrix, map) {
    const originPoint = _toPoint(map, origin);
    this._matrix = _matrix.clone().rotate(radiant, originPoint).flip();
    return _convertLatLngs(latlngs, this._matrix, map);
  },
  _setAngle(angle) {
    angle = angle < 0 ? angle + 360 : angle;
    this._angle = angle % 360;
  },
  _getRotationCenter() {
    if (this._rotationCenter) {
      return this._rotationCenter;
    }
    const polygon = L.polygon(this._layer.getLatLngs(), {
      stroke: false,
      fill: false,
      pmIgnore: true
    }).addTo(this._layer._map);
    const center = polygon.getCenter();
    polygon.removeFrom(this._layer._map);
    return center;
  },
  /*
   *
   * Public functions f.ex. to disable and enable rotation on the layer directly
   *
   */
  enableRotate() {
    if (!this.options.allowRotation) {
      this.disableRotate();
      return;
    }
    if (this.rotateEnabled()) {
      this.disableRotate();
    }
    if (this._layer instanceof L.Rectangle && this._angle === void 0) {
      this.setInitAngle(
        calcAngle(
          this._layer._map,
          this._layer.getLatLngs()[0][0],
          this._layer.getLatLngs()[0][1]
        ) || 0
      );
    }
    const options = {
      fill: false,
      stroke: false,
      pmIgnore: false,
      snapIgnore: true
    };
    this._rotatePoly = L.polygon(this._layer.getLatLngs(), options);
    this._rotatePoly._pmTempLayer = true;
    this._rotatePoly.addTo(this._layer._map);
    this._rotatePoly.pm._setAngle(this.getAngle());
    this._rotatePoly.pm.setRotationCenter(this.getRotationCenter());
    this._rotatePoly.pm.setOptions(this._layer._map.pm.getGlobalOptions());
    this._rotatePoly.pm.setOptions({
      rotate: true,
      snappable: false,
      hideMiddleMarkers: true
    });
    this._rotatePoly.pm._rotationLayer = this._layer;
    this._rotatePoly.pm.enable();
    this._rotateOrgLatLng = copyLatLngs(this._layer);
    this._rotateEnabled = true;
    this._layer.on("remove", this.disableRotate, this);
    this._fireRotationEnable(this._layer);
    this._fireRotationEnable(this._layer._map);
  },
  disableRotate() {
    if (this.rotateEnabled()) {
      if (this._rotatePoly.pm._layerRotated) {
        this._fireUpdate();
      }
      this._rotatePoly.pm._layerRotated = false;
      this._rotatePoly.pm.disable();
      this._rotatePoly.remove();
      this._rotatePoly.pm.setOptions({ rotate: false });
      this._rotatePoly = void 0;
      this._rotateOrgLatLng = void 0;
      this._layer.off("remove", this.disableRotate, this);
      this._rotateEnabled = false;
      this._fireRotationDisable(this._layer);
      this._fireRotationDisable(this._layer._map);
    }
  },
  rotateEnabled() {
    return !!this._rotateEnabled;
  },
  // angle is clockwise (0-360)
  rotateLayer(degrees) {
    const oldAngle = this.getAngle();
    const oldLatLngs = this._layer.getLatLngs();
    const rads = degrees * (Math.PI / 180);
    this._layer.setLatLngs(
      this._rotateLayer(
        rads,
        this._layer.getLatLngs(),
        this._getRotationCenter(),
        L.PM.Matrix.init(),
        this._layer._map
      )
    );
    this._rotateOrgLatLng = L.polygon(this._layer.getLatLngs()).getLatLngs();
    this._setAngle(this.getAngle() + degrees);
    if (this.rotateEnabled() && this._rotatePoly && this._rotatePoly.pm.enabled()) {
      this._rotatePoly.setLatLngs(
        this._rotateLayer(
          rads,
          this._rotatePoly.getLatLngs(),
          this._getRotationCenter(),
          L.PM.Matrix.init(),
          this._rotatePoly._map
        )
      );
      this._rotatePoly.pm._initMarkers();
    }
    let angleDiff = this.getAngle() - oldAngle;
    angleDiff = angleDiff < 0 ? angleDiff + 360 : angleDiff;
    this._startAngle = oldAngle;
    this._fireRotation(this._layer, angleDiff, oldLatLngs, this._layer);
    this._fireRotation(
      this._map || this._layer._map,
      angleDiff,
      oldLatLngs,
      this._layer
    );
    delete this._startAngle;
    this._fireChange(this._layer.getLatLngs(), "Rotation");
  },
  rotateLayerToAngle(degrees) {
    const newAnlge = degrees - this.getAngle();
    this.rotateLayer(newAnlge);
  },
  // angle is clockwise (0-360)
  getAngle() {
    return this._angle || 0;
  },
  // angle is clockwise (0-360)
  setInitAngle(degrees) {
    this._setAngle(degrees);
  },
  getRotationCenter() {
    return this._getRotationCenter();
  },
  setRotationCenter(center) {
    this._rotationCenter = center;
    if (this._rotatePoly) {
      this._rotatePoly.pm.setRotationCenter(center);
    }
  }
};
var Rotating_default = RotateMixin;

// L.PM.Edit.js
var Edit = L.Class.extend({
  includes: [Dragging_default, Snapping_default, Rotating_default, Events_default],
  options: {
    snappable: true,
    // TODO: next major Release, rename it to allowSnapping
    snapDistance: 20,
    allowSelfIntersection: true,
    allowSelfIntersectionEdit: false,
    preventMarkerRemoval: false,
    removeLayerBelowMinVertexCount: true,
    limitMarkersToCount: -1,
    hideMiddleMarkers: false,
    snapSegment: true,
    syncLayersOnDrag: false,
    draggable: true,
    // TODO: next major Release, rename it to allowDragging
    allowEditing: true,
    // disable all interactions on a layer which are activated with `enable()`. For example a Circle can't be dragged in Edit-Mode
    allowRemoval: true,
    allowCutting: true,
    allowRotation: true,
    addVertexOn: "click",
    removeVertexOn: "contextmenu",
    removeVertexValidation: void 0,
    addVertexValidation: void 0,
    moveVertexValidation: void 0,
    resizeableCircleMarker: false,
    resizeableCircle: true
  },
  setOptions(options) {
    L.Util.setOptions(this, options);
  },
  getOptions() {
    return this.options;
  },
  applyOptions() {
  },
  isPolygon() {
    return this._layer instanceof L.Polygon;
  },
  getShape() {
    return this._shape;
  },
  _setPane(layer, type) {
    if (type === "layerPane") {
      layer.options.pane = this._map.pm.globalOptions.panes && this._map.pm.globalOptions.panes.layerPane || "overlayPane";
    } else if (type === "vertexPane") {
      layer.options.pane = this._map.pm.globalOptions.panes && this._map.pm.globalOptions.panes.vertexPane || "markerPane";
    } else if (type === "markerPane") {
      layer.options.pane = this._map.pm.globalOptions.panes && this._map.pm.globalOptions.panes.markerPane || "markerPane";
    }
  },
  remove() {
    const map = this._map || this._layer._map;
    map.pm.removeLayer({ target: this._layer });
  },
  _vertexValidation(type, e) {
    const marker = e.target;
    const args = { layer: this._layer, marker, event: e };
    let validationFnc = "";
    if (type === "move") {
      validationFnc = "moveVertexValidation";
    } else if (type === "add") {
      validationFnc = "addVertexValidation";
    } else if (type === "remove") {
      validationFnc = "removeVertexValidation";
    }
    if (this.options[validationFnc] && typeof this.options[validationFnc] === "function" && !this.options[validationFnc](args)) {
      if (type === "move") {
        marker._cancelDragEventChain = marker.getLatLng();
      }
      return false;
    }
    marker._cancelDragEventChain = null;
    return true;
  },
  _vertexValidationDrag(marker) {
    if (marker._cancelDragEventChain) {
      marker._latlng = marker._cancelDragEventChain;
      marker.update();
      return false;
    }
    return true;
  },
  _vertexValidationDragEnd(marker) {
    if (marker._cancelDragEventChain) {
      marker._cancelDragEventChain = null;
      return false;
    }
    return true;
  }
});
var L_PM_Edit_default = Edit;

// L.PM.Edit.LayerGroup.js
L_PM_Edit_default.LayerGroup = L.Class.extend({
  initialize(layerGroup) {
    this._layerGroup = layerGroup;
    this._layers = this.getLayers();
    this._getMap();
    this._layers.forEach((layer) => this._initLayer(layer));
    const addThrottle = (e) => {
      if (e.layer._pmTempLayer) {
        return;
      }
      this._layers = this.getLayers();
      const _initLayers = this._layers.filter(
        (layer) => !layer.pm._parentLayerGroup || !(this._layerGroup._leaflet_id in layer.pm._parentLayerGroup)
      );
      _initLayers.forEach((layer) => {
        this._initLayer(layer);
      });
      if (_initLayers.length > 0 && this._getMap() && this._getMap().pm.getGlobalEditModeEnabled()) {
        if (this.enabled()) {
          this.enable(this.getOptions());
        }
      }
    };
    this._layerGroup.on(
      "layeradd",
      L.Util.throttle(addThrottle, 100, this),
      this
    );
    this._layerGroup.on(
      "layerremove",
      (e) => {
        this._removeLayerFromGroup(e.target);
      },
      this
    );
    const removeThrottle = (e) => {
      if (e.target._pmTempLayer) {
        return;
      }
      this._layers = this.getLayers();
    };
    this._layerGroup.on(
      "layerremove",
      L.Util.throttle(removeThrottle, 100, this),
      this
    );
  },
  enable(options, _layerIds = []) {
    if (_layerIds.length === 0) {
      this._layers = this.getLayers();
    }
    this._options = options;
    this._layers.forEach((layer) => {
      if (layer instanceof L.LayerGroup) {
        if (_layerIds.indexOf(layer._leaflet_id) === -1) {
          _layerIds.push(layer._leaflet_id);
          layer.pm.enable(options, _layerIds);
        }
      } else {
        layer.pm.enable(options);
      }
    });
  },
  disable(_layerIds = []) {
    if (_layerIds.length === 0) {
      this._layers = this.getLayers();
    }
    this._layers.forEach((layer) => {
      if (layer instanceof L.LayerGroup) {
        if (_layerIds.indexOf(layer._leaflet_id) === -1) {
          _layerIds.push(layer._leaflet_id);
          layer.pm.disable(_layerIds);
        }
      } else {
        layer.pm.disable();
      }
    });
  },
  enabled(_layerIds = []) {
    if (_layerIds.length === 0) {
      this._layers = this.getLayers();
    }
    const enabled = this._layers.find((layer) => {
      if (layer instanceof L.LayerGroup) {
        if (_layerIds.indexOf(layer._leaflet_id) === -1) {
          _layerIds.push(layer._leaflet_id);
          return layer.pm.enabled(_layerIds);
        }
        return false;
      }
      return layer.pm.enabled();
    });
    return !!enabled;
  },
  toggleEdit(options, _layerIds = []) {
    if (_layerIds.length === 0) {
      this._layers = this.getLayers();
    }
    this._options = options;
    this._layers.forEach((layer) => {
      if (layer instanceof L.LayerGroup) {
        if (_layerIds.indexOf(layer._leaflet_id) === -1) {
          _layerIds.push(layer._leaflet_id);
          layer.pm.toggleEdit(options, _layerIds);
        }
      } else {
        layer.pm.toggleEdit(options);
      }
    });
  },
  _initLayer(layer) {
    const id = L.Util.stamp(this._layerGroup);
    if (!layer.pm._parentLayerGroup) {
      layer.pm._parentLayerGroup = {};
    }
    layer.pm._parentLayerGroup[id] = this._layerGroup;
  },
  _removeLayerFromGroup(layer) {
    if (layer.pm && layer.pm._layerGroup) {
      const id = L.Util.stamp(this._layerGroup);
      delete layer.pm._layerGroup[id];
    }
  },
  dragging() {
    this._layers = this.getLayers();
    if (this._layers) {
      const dragging = this._layers.find((layer) => layer.pm.dragging());
      return !!dragging;
    }
    return false;
  },
  getOptions() {
    return this.options;
  },
  _getMap() {
    return this._map || this._layers.find((l) => !!l._map)?._map || null;
  },
  getLayers(deep = false, filterGeoman = true, filterGroupsOut = true, _layerIds = []) {
    let layers = [];
    if (deep) {
      this._layerGroup.getLayers().forEach((layer) => {
        layers.push(layer);
        if (layer instanceof L.LayerGroup) {
          if (_layerIds.indexOf(layer._leaflet_id) === -1) {
            _layerIds.push(layer._leaflet_id);
            layers = layers.concat(
              layer.pm.getLayers(true, true, true, _layerIds)
            );
          }
        }
      });
    } else {
      layers = this._layerGroup.getLayers();
    }
    if (filterGroupsOut) {
      layers = layers.filter((layer) => !(layer instanceof L.LayerGroup));
    }
    if (filterGeoman) {
      layers = layers.filter((layer) => !!layer.pm);
      layers = layers.filter((layer) => !layer._pmTempLayer);
      layers = layers.filter(
        (layer) => !L.PM.optIn && !layer.options.pmIgnore || // if optIn is not set / true and pmIgnore is not set / true (default)
          L.PM.optIn && layer.options.pmIgnore === false
        // if optIn is true and pmIgnore is false);
      );
    }
    return layers;
  },
  setOptions(options, _layerIds = []) {
    if (_layerIds.length === 0) {
      this._layers = this.getLayers();
    }
    this.options = options;
    this._layers.forEach((layer) => {
      if (layer.pm) {
        if (layer instanceof L.LayerGroup) {
          if (_layerIds.indexOf(layer._leaflet_id) === -1) {
            _layerIds.push(layer._leaflet_id);
            layer.pm.setOptions(options, _layerIds);
          }
        } else {
          layer.pm.setOptions(options);
        }
      }
    });
  }
});

// L.PM.Edit.Marker.js
L_PM_Edit_default.Marker = L_PM_Edit_default.extend({
  _shape: "Marker",
  initialize(layer) {
    this._layer = layer;
    this._enabled = false;
    this._layer.on("dragend", this._onDragEnd, this);
  },
  // TODO: remove default option in next major Release
  enable(options = { draggable: true }) {
    L.Util.setOptions(this, options);
    if (!this.options.allowEditing || !this._layer._map) {
      this.disable();
      return;
    }
    this._map = this._layer._map;
    if (this.enabled()) {
      this.disable();
    }
    this.applyOptions();
    this._layer.on("remove", this.disable, this);
    this._enabled = true;
    this._fireEnable();
  },
  disable() {
    if (!this.enabled()) {
      return;
    }
    this.disableLayerDrag();
    this._layer.off("remove", this.disable, this);
    this._layer.off("contextmenu", this._removeMarker, this);
    if (this._layerEdited) {
      this._fireUpdate();
    }
    this._layerEdited = false;
    this._fireDisable();
    this._enabled = false;
  },
  enabled() {
    return this._enabled;
  },
  toggleEdit(options) {
    if (!this.enabled()) {
      this.enable(options);
    } else {
      this.disable();
    }
  },
  applyOptions() {
    if (this.options.snappable) {
      this._initSnappableMarkers();
    } else {
      this._disableSnapping();
    }
    if (this.options.draggable) {
      this.enableLayerDrag();
    } else {
      this.disableLayerDrag();
    }
    if (!this.options.preventMarkerRemoval) {
      this._layer.on("contextmenu", this._removeMarker, this);
    }
  },
  _removeMarker(e) {
    const marker = e.target;
    marker.remove();
    this._fireRemove(marker);
    this._fireRemove(this._map, marker);
  },
  _onDragEnd() {
    this._fireEdit();
    this._layerEdited = true;
  },
  // overwrite initSnappableMarkers from Snapping.js Mixin
  _initSnappableMarkers() {
    const marker = this._layer;
    this.options.snapDistance = this.options.snapDistance || 30;
    this.options.snapSegment = this.options.snapSegment === void 0 ? true : this.options.snapSegment;
    marker.off("pm:drag", this._handleSnapping, this);
    marker.on("pm:drag", this._handleSnapping, this);
    marker.off("pm:dragend", this._cleanupSnapping, this);
    marker.on("pm:dragend", this._cleanupSnapping, this);
    marker.off("pm:dragstart", this._unsnap, this);
    marker.on("pm:dragstart", this._unsnap, this);
  },
  _disableSnapping() {
    const marker = this._layer;
    marker.off("pm:drag", this._handleSnapping, this);
    marker.off("pm:dragend", this._cleanupSnapping, this);
    marker.off("pm:dragstart", this._unsnap, this);
  }
});

// MarkerLimits.js
var MarkerLimits = {
  filterMarkerGroup() {
    this.markerCache = [];
    this.createCache();
    this._layer.on("pm:edit", this.createCache, this);
    this.applyLimitFilters({});
    if (!this.throttledApplyLimitFilters) {
      this.throttledApplyLimitFilters = L.Util.throttle(
        this.applyLimitFilters,
        100,
        this
      );
    }
    this._layer.on("pm:disable", this._removeMarkerLimitEvents, this);
    this._layer.on("remove", this._removeMarkerLimitEvents, this);
    if (this.options.limitMarkersToCount > -1) {
      this._layer.on("pm:vertexremoved", this._initMarkers, this);
      this._map.on("mousemove", this.throttledApplyLimitFilters, this);
    }
  },
  _removeMarkerLimitEvents() {
    this._map.off("mousemove", this.throttledApplyLimitFilters, this);
    this._layer.off("pm:edit", this.createCache, this);
    this._layer.off("pm:disable", this._removeMarkerLimitEvents, this);
    this._layer.off("pm:vertexremoved", this._initMarkers, this);
  },
  createCache() {
    const allMarkers = [...this._markerGroup.getLayers(), ...this.markerCache];
    this.markerCache = allMarkers.filter((v, i, s) => s.indexOf(v) === i);
  },
  _removeFromCache(marker) {
    const markerCacheIndex = this.markerCache.indexOf(marker);
    if (markerCacheIndex > -1) {
      this.markerCache.splice(markerCacheIndex, 1);
    }
  },
  renderLimits(markers) {
    this.markerCache.forEach((l) => {
      if (markers.includes(l)) {
        this._markerGroup.addLayer(l);
      } else {
        this._markerGroup.removeLayer(l);
      }
    });
  },
  applyLimitFilters({ latlng = { lat: 0, lng: 0 } }) {
    if (this._preventRenderMarkers) {
      return;
    }
    const makersNearCursor = this._filterClosestMarkers(latlng);
    const markersToAdd = [...makersNearCursor];
    this.renderLimits(markersToAdd);
  },
  _filterClosestMarkers(latlng) {
    const markers = [...this.markerCache];
    const limit = this.options.limitMarkersToCount;
    if (limit === -1) {
      return markers;
    }
    markers.sort((l, t) => {
      const distanceA = l._latlng.distanceTo(latlng);
      const distanceB = t._latlng.distanceTo(latlng);
      return distanceA - distanceB;
    });
    const closest = markers.filter((l, i) => limit > -1 ? i < limit : true);
    return closest;
  },
  _preventRenderMarkers: false,
  _preventRenderingMarkers(value) {
    this._preventRenderMarkers = !!value;
  }
};
var MarkerLimits_default = MarkerLimits;

L_PM_Edit_default.Line = L_PM_Edit_default.extend({
  includes: [MarkerLimits_default],
  _shape: "Line",
  initialize(layer) {
    this._layer = layer;
    this._enabled = false;
  },
  enable(options) {
    L.Util.setOptions(this, options);
    this._map = this._layer._map;
    if (!this._map) {
      return;
    }
    if (!this.options.allowEditing) {
      this.disable();
      return;
    }
    if (this.enabled()) {
      this.disable();
    }
    this._enabled = true;
    this._initMarkers();
    this.applyOptions();
    this._layer.on("remove", this.disable, this);
    if (!this.options.allowSelfIntersection) {
      this._layer.on(
        "pm:vertexremoved",
        this._handleSelfIntersectionOnVertexRemoval,
        this
      );
    }
    if (!this.options.allowSelfIntersection) {
      if (this._layer.options.color !== "#f00000ff") {
        this.cachedColor = this._layer.options.color;
        this.isRed = false;
      } else {
        this.isRed = true;
      }
      this._handleLayerStyle();
    } else {
      this.cachedColor = void 0;
    }
    this._fireEnable();
  },
  disable() {
    if (!this.enabled()) {
      return;
    }
    if (this._dragging) {
      return;
    }
    this._enabled = false;
    this._markerGroup.clearLayers();
    this._markerGroup.removeFrom(this._map);
    this._layer.off("remove", this.disable, this);
    if (!this.options.allowSelfIntersection) {
      this._layer.off(
        "pm:vertexremoved",
        this._handleSelfIntersectionOnVertexRemoval,
        this
      );
    }
    const el = this._layer._path ? this._layer._path : this._layer._renderer._container;
    L.DomUtil.removeClass(el, "leaflet-pm-draggable");
    if (this._layerEdited) {
      this._fireUpdate();
    }
    this._layerEdited = false;
    this._fireDisable();
  },
  enabled() {
    return this._enabled;
  },
  toggleEdit(options) {
    if (!this.enabled()) {
      this.enable(options);
    } else {
      this.disable();
    }
    return this.enabled();
  },
  applyOptions() {
    if (this.options.snappable) {
      this._initSnappableMarkers();
    } else {
      this._disableSnapping();
    }
  },
  _initMarkers() {
    const map = this._map;
    const coords = this._layer.getLatLngs();
    if (this._markerGroup) {
      this._markerGroup.clearLayers();
    }
    this._markerGroup = new L.FeatureGroup();
    this._markerGroup._pmTempLayer = true;
    const handleRing = (coordsArr) => {
      if (Array.isArray(coordsArr[0])) {
        return coordsArr.map(handleRing, this);
      }
      const ringArr = coordsArr.map(this._createMarker, this);
      if (this.options.hideMiddleMarkers !== true) {
        coordsArr.map((v, k) => {
          const nextIndex = this.isPolygon() ? (k + 1) % coordsArr.length : k + 1;
          return this._createMiddleMarker(ringArr[k], ringArr[nextIndex]);
        });
      }
      return ringArr;
    };
    this._markers = handleRing(coords);
    this.filterMarkerGroup();
    map.addLayer(this._markerGroup);
  },
  // creates initial markers for coordinates
  _createMarker(latlng) {
    const marker = new L.Marker(latlng, {
      draggable: true,
      icon: L.divIcon({ className: "marker-icon" })
    });
    this._setPane(marker, "vertexPane");
    marker._pmTempLayer = true;
    if (this.options.rotate) {
      marker.on("dragstart", this._onRotateStart, this);
      marker.on("drag", this._onRotate, this);
      marker.on("dragend", this._onRotateEnd, this);
    } else {
      marker.on("click", this._onVertexClick, this);
      marker.on("dragstart", this._onMarkerDragStart, this);
      marker.on("move", this._onMarkerDrag, this);
      marker.on("dragend", this._onMarkerDragEnd, this);
      if (!this.options.preventMarkerRemoval) {
        marker.on(this.options.removeVertexOn, this._removeMarker, this);
      }
    }
    this._markerGroup.addLayer(marker);
    return marker;
  },
  // creates the middle markes between coordinates
  _createMiddleMarker(leftM, rightM) {
    if (!leftM || !rightM) {
      return false;
    }
    const latlng = L.PM.Utils.calcMiddleLatLng(
      this._map,
      leftM.getLatLng(),
      rightM.getLatLng()
    );
    const middleMarker = this._createMarker(latlng);
    const middleIcon = L.divIcon({
      className: "marker-icon marker-icon-middle"
    });
    middleMarker.setIcon(middleIcon);
    middleMarker.leftM = leftM;
    middleMarker.rightM = rightM;
    leftM._middleMarkerNext = middleMarker;
    rightM._middleMarkerPrev = middleMarker;
    middleMarker.on(this.options.addVertexOn, this._onMiddleMarkerClick, this);
    middleMarker.on("movestart", this._onMiddleMarkerMoveStart, this);
    return middleMarker;
  },
  _onMiddleMarkerClick(e) {
    const middleMarker = e.target;
    if (!this._vertexValidation("add", e)) {
      return;
    }
    const icon = L.divIcon({ className: "marker-icon" });
    middleMarker.setIcon(icon);
    this._addMarker(middleMarker, middleMarker.leftM, middleMarker.rightM);
  },
  _onMiddleMarkerMoveStart(e) {
    const middleMarker = e.target;
    middleMarker.on("moveend", this._onMiddleMarkerMoveEnd, this);
    if (!this._vertexValidation("add", e)) {
      middleMarker.on("move", this._onMiddleMarkerMovePrevent, this);
      return;
    }
    middleMarker._dragging = true;
    this._addMarker(middleMarker, middleMarker.leftM, middleMarker.rightM);
  },
  _onMiddleMarkerMovePrevent(e) {
    const middleMarker = e.target;
    this._vertexValidationDrag(middleMarker);
  },
  _onMiddleMarkerMoveEnd(e) {
    const middleMarker = e.target;
    middleMarker.off("move", this._onMiddleMarkerMovePrevent, this);
    middleMarker.off("moveend", this._onMiddleMarkerMoveEnd, this);
    if (!this._vertexValidationDragEnd(middleMarker)) {
      return;
    }
    const icon = L.divIcon({ className: "marker-icon" });
    middleMarker.setIcon(icon);
    setTimeout(() => {
      delete middleMarker._dragging;
    }, 100);
  },
  // adds a new marker from a middlemarker
  _addMarker(newM, leftM, rightM) {
    newM.off("movestart", this._onMiddleMarkerMoveStart, this);
    newM.off(this.options.addVertexOn, this._onMiddleMarkerClick, this);
    const latlng = newM.getLatLng();
    const coords = this._layer._latlngs;
    delete newM.leftM;
    delete newM.rightM;
    const { indexPath, index, parentPath } = L.PM.Utils.findDeepMarkerIndex(
      this._markers,
      leftM
    );
    const coordsRing = indexPath.length > 1 ? get(coords, parentPath) : coords;
    const markerArr = indexPath.length > 1 ? get(this._markers, parentPath) : this._markers;
    coordsRing.splice(index + 1, 0, latlng);
    markerArr.splice(index + 1, 0, newM);
    this._layer.setLatLngs(coords);
    if (this.options.hideMiddleMarkers !== true) {
      this._createMiddleMarker(leftM, newM);
      this._createMiddleMarker(newM, rightM);
    }
    this._fireEdit();
    this._layerEdited = true;
    this._fireChange(this._layer.getLatLngs(), "Edit");
    this._fireVertexAdded(
      newM,
      L.PM.Utils.findDeepMarkerIndex(this._markers, newM).indexPath,
      latlng
    );
    if (this.options.snappable) {
      this._initSnappableMarkers();
    }
  },
  hasSelfIntersection() {
    const selfIntersection = kinks(this._layer.toGeoJSON(15));
    return selfIntersection.features.length > 0;
  },
  _handleSelfIntersectionOnVertexRemoval() {
    const selfIntersection = this._handleLayerStyle(true);
    if (selfIntersection) {
      this._layer.setLatLngs(this._coordsBeforeEdit);
      this._coordsBeforeEdit = null;
      this._initMarkers();
    }
  },
  _handleLayerStyle(flash) {
    const layer = this._layer;
    let selfIntersection;
    let intersection;
    if (this.options.allowSelfIntersection) {
      selfIntersection = false;
    } else {
      intersection = kinks(this._layer.toGeoJSON(15));
      selfIntersection = intersection.features.length > 0;
    }
    if (selfIntersection) {
      if (!this.options.allowSelfIntersection && this.options.allowSelfIntersectionEdit) {
        this._updateDisabledMarkerStyle(this._markers, true);
      }
      if (this.isRed) {
        return selfIntersection;
      }
      if (flash) {
        this._flashLayer();
      } else {
        layer.setStyle({ color: "#f00000ff" });
        this.isRed = true;
      }
      this._fireIntersect(intersection);
    } else {
      layer.setStyle({ color: this.cachedColor });
      this.isRed = false;
      if (!this.options.allowSelfIntersection && this.options.allowSelfIntersectionEdit) {
        this._updateDisabledMarkerStyle(this._markers, false);
      }
    }
    return selfIntersection;
  },
  _flashLayer() {
    if (!this.cachedColor) {
      this.cachedColor = this._layer.options.color;
    }
    this._layer.setStyle({ color: "#f00000ff" });
    this.isRed = true;
    window.setTimeout(() => {
      this._layer.setStyle({ color: this.cachedColor });
      this.isRed = false;
    }, 200);
  },
  _updateDisabledMarkerStyle(markers, disabled) {
    markers.forEach((marker) => {
      if (Array.isArray(marker)) {
        this._updateDisabledMarkerStyle(marker, disabled);
      } else if (marker._icon) {
        if (disabled && !this._checkMarkerAllowedToDrag(marker)) {
          L.DomUtil.addClass(marker._icon, "vertexmarker-disabled");
        } else {
          L.DomUtil.removeClass(marker._icon, "vertexmarker-disabled");
        }
      }
    });
  },
  _removeMarker(e) {
    const marker = e.target;
    if (!this._vertexValidation("remove", e)) {
      return;
    }
    if (!this.options.allowSelfIntersection) {
      this._coordsBeforeEdit = copyLatLngs(
        this._layer,
        this._layer.getLatLngs()
      );
    }
    let coords = this._layer.getLatLngs();
    const { indexPath, index, parentPath } = L.PM.Utils.findDeepMarkerIndex(
      this._markers,
      marker
    );
    if (!indexPath) {
      return;
    }
    const coordsRing = indexPath.length > 1 ? get(coords, parentPath) : coords;
    let markerArr = indexPath.length > 1 ? get(this._markers, parentPath) : this._markers;
    if (!this.options.removeLayerBelowMinVertexCount) {
      if (coordsRing.length <= 2 || this.isPolygon() && coordsRing.length <= 3) {
        this._flashLayer();
        return;
      }
    }
    coordsRing.splice(index, 1);
    this._layer.setLatLngs(coords);
    if (this.isPolygon() && coordsRing.length <= 2) {
      coordsRing.splice(0, coordsRing.length);
    }
    let layerRemoved = false;
    if (coordsRing.length <= 1) {
      coordsRing.splice(0, coordsRing.length);
      if (parentPath.length > 1 && indexPath.length > 1) {
        coords = removeEmptyCoordRings(coords);
      }
      this._layer.setLatLngs(coords);
      this._initMarkers();
      layerRemoved = true;
    }
    if (!hasValues(coords)) {
      this._layer.remove();
    }
    coords = removeEmptyCoordRings(coords);
    this._layer.setLatLngs(coords);
    this._markers = removeEmptyCoordRings(this._markers);
    if (!layerRemoved) {
      markerArr = indexPath.length > 1 ? get(this._markers, parentPath) : this._markers;
      if (marker._middleMarkerPrev) {
        this._markerGroup.removeLayer(marker._middleMarkerPrev);
        this._removeFromCache(marker._middleMarkerPrev);
      }
      if (marker._middleMarkerNext) {
        this._markerGroup.removeLayer(marker._middleMarkerNext);
        this._removeFromCache(marker._middleMarkerNext);
      }
      this._markerGroup.removeLayer(marker);
      this._removeFromCache(marker);
      if (markerArr) {
        let rightMarkerIndex;
        let leftMarkerIndex;
        if (this.isPolygon()) {
          rightMarkerIndex = (index + 1) % markerArr.length;
          leftMarkerIndex = (index + (markerArr.length - 1)) % markerArr.length;
        } else {
          leftMarkerIndex = index - 1 < 0 ? void 0 : index - 1;
          rightMarkerIndex = index + 1 >= markerArr.length ? void 0 : index + 1;
        }
        if (rightMarkerIndex !== leftMarkerIndex) {
          const leftM = markerArr[leftMarkerIndex];
          const rightM = markerArr[rightMarkerIndex];
          if (this.options.hideMiddleMarkers !== true) {
            this._createMiddleMarker(leftM, rightM);
          }
        }
        markerArr.splice(index, 1);
      }
    }
    this._fireEdit();
    this._layerEdited = true;
    this._fireVertexRemoved(marker, indexPath);
    this._fireChange(this._layer.getLatLngs(), "Edit");
  },
  updatePolygonCoordsFromMarkerDrag(marker) {
    const coords = this._layer.getLatLngs();
    const latlng = marker.getLatLng();
    const { indexPath, index, parentPath } = L.PM.Utils.findDeepMarkerIndex(
      this._markers,
      marker
    );
    const parent = indexPath.length > 1 ? get(coords, parentPath) : coords;
    parent.splice(index, 1, latlng);
    this._layer.setLatLngs(coords);
  },
  _getNeighborMarkers(marker) {
    const { indexPath, index, parentPath } = L.PM.Utils.findDeepMarkerIndex(
      this._markers,
      marker
    );
    const markerArr = indexPath.length > 1 ? get(this._markers, parentPath) : this._markers;
    const nextMarkerIndex = (index + 1) % markerArr.length;
    const prevMarkerIndex = (index + (markerArr.length - 1)) % markerArr.length;
    const prevMarker = markerArr[prevMarkerIndex];
    const nextMarker = markerArr[nextMarkerIndex];
    return { prevMarker, nextMarker };
  },
  _checkMarkerAllowedToDrag(marker) {
    const { prevMarker, nextMarker } = this._getNeighborMarkers(marker);
    const prevLine = L.polyline([prevMarker.getLatLng(), marker.getLatLng()]);
    const nextLine = L.polyline([marker.getLatLng(), nextMarker.getLatLng()]);
    let prevLineIntersectionLen = lineIntersect(
      this._layer.toGeoJSON(15),
      prevLine.toGeoJSON(15)
    ).features.length;
    let nextLineIntersectionLen = lineIntersect(
      this._layer.toGeoJSON(15),
      nextLine.toGeoJSON(15)
    ).features.length;
    if (marker.getLatLng() === this._markers[0][0].getLatLng()) {
      nextLineIntersectionLen += 1;
    } else if (marker.getLatLng() === this._markers[0][this._markers[0].length - 1].getLatLng()) {
      prevLineIntersectionLen += 1;
    }
    if (prevLineIntersectionLen <= 2 && nextLineIntersectionLen <= 2) {
      return false;
    }
    return true;
  },
  _onMarkerDragStart(e) {
    const marker = e.target;
    if (!this.cachedColor) {
      this.cachedColor = this._layer.options.color;
    }
    if (!this._vertexValidation("move", e)) {
      return;
    }
    const { indexPath } = L.PM.Utils.findDeepMarkerIndex(this._markers, marker);
    this._fireMarkerDragStart(e, indexPath);
    if (!this.options.allowSelfIntersection) {
      this._coordsBeforeEdit = copyLatLngs(
        this._layer,
        this._layer.getLatLngs()
      );
    }
    if (!this.options.allowSelfIntersection && this.options.allowSelfIntersectionEdit && this.hasSelfIntersection()) {
      this._markerAllowedToDrag = this._checkMarkerAllowedToDrag(marker);
    } else {
      this._markerAllowedToDrag = null;
    }
  },
  _onMarkerDrag(e) {
    const marker = e.target;
    if (!this._vertexValidationDrag(marker)) {
      return;
    }
    const { indexPath, index, parentPath } = L.PM.Utils.findDeepMarkerIndex(
      this._markers,
      marker
    );
    if (!indexPath) {
      return;
    }
    if (!this.options.allowSelfIntersection && this.options.allowSelfIntersectionEdit && this.hasSelfIntersection() && this._markerAllowedToDrag === false) {
      this._layer.setLatLngs(this._coordsBeforeEdit);
      this._initMarkers();
      this._handleLayerStyle();
      return;
    }
    this.updatePolygonCoordsFromMarkerDrag(marker);
    const markerArr = indexPath.length > 1 ? get(this._markers, parentPath) : this._markers;
    const nextMarkerIndex = (index + 1) % markerArr.length;
    const prevMarkerIndex = (index + (markerArr.length - 1)) % markerArr.length;
    const markerLatLng = marker.getLatLng();
    const prevMarkerLatLng = markerArr[prevMarkerIndex].getLatLng();
    const nextMarkerLatLng = markerArr[nextMarkerIndex].getLatLng();
    if (marker._middleMarkerNext) {
      const middleMarkerNextLatLng = L.PM.Utils.calcMiddleLatLng(
        this._map,
        markerLatLng,
        nextMarkerLatLng
      );
      marker._middleMarkerNext.setLatLng(middleMarkerNextLatLng);
    }
    if (marker._middleMarkerPrev) {
      const middleMarkerPrevLatLng = L.PM.Utils.calcMiddleLatLng(
        this._map,
        markerLatLng,
        prevMarkerLatLng
      );
      marker._middleMarkerPrev.setLatLng(middleMarkerPrevLatLng);
    }
    if (!this.options.allowSelfIntersection) {
      this._handleLayerStyle();
    }
    this._fireMarkerDrag(e, indexPath);
    this._fireChange(this._layer.getLatLngs(), "Edit");
  },
  _onMarkerDragEnd(e) {
    const marker = e.target;
    if (!this._vertexValidationDragEnd(marker)) {
      return;
    }
    const { indexPath } = L.PM.Utils.findDeepMarkerIndex(this._markers, marker);
    let intersection = this.hasSelfIntersection();
    if (intersection && this.options.allowSelfIntersectionEdit && this._markerAllowedToDrag) {
      intersection = false;
    }
    const intersectionReset = !this.options.allowSelfIntersection && intersection;
    this._fireMarkerDragEnd(e, indexPath, intersectionReset);
    if (intersectionReset) {
      this._layer.setLatLngs(this._coordsBeforeEdit);
      this._coordsBeforeEdit = null;
      this._initMarkers();
      if (this.options.snappable) {
        this._initSnappableMarkers();
      }
      this._handleLayerStyle();
      this._fireLayerReset(e, indexPath);
      return;
    }
    if (!this.options.allowSelfIntersection && this.options.allowSelfIntersectionEdit) {
      this._handleLayerStyle();
    }
    this._fireEdit();
    this._layerEdited = true;
    this._fireChange(this._layer.getLatLngs(), "Edit");
  },
  _onVertexClick(e) {
    const vertex = e.target;
    if (vertex._dragging) {
      return;
    }
    const { indexPath } = L.PM.Utils.findDeepMarkerIndex(this._markers, vertex);
    this._fireVertexClick(e, indexPath);
  }
});

L_PM_Edit_default.Polygon = L_PM_Edit_default.Line.extend({
  _shape: "Polygon",
  _checkMarkerAllowedToDrag(marker) {
    const { prevMarker, nextMarker } = this._getNeighborMarkers(marker);
    const prevLine = L.polyline([prevMarker.getLatLng(), marker.getLatLng()]);
    const nextLine = L.polyline([marker.getLatLng(), nextMarker.getLatLng()]);
    const prevLineIntersectionLen = lineIntersect(
      this._layer.toGeoJSON(15),
      prevLine.toGeoJSON(15)
    ).features.length;
    const nextLineIntersectionLen = lineIntersect(
      this._layer.toGeoJSON(15),
      nextLine.toGeoJSON(15)
    ).features.length;
    if (prevLineIntersectionLen <= 2 && nextLineIntersectionLen <= 2) {
      return false;
    }
    return true;
  }
});

// L.PM.Edit.Rectangle.js
L_PM_Edit_default.Rectangle = L_PM_Edit_default.Polygon.extend({
  _shape: "Rectangle",
  // initializes Rectangle Markers
  _initMarkers() {
    const map = this._map;
    const corners = this._findCorners();
    if (this._markerGroup) {
      this._markerGroup.clearLayers();
    }
    this._markerGroup = new L.FeatureGroup();
    this._markerGroup._pmTempLayer = true;
    map.addLayer(this._markerGroup);
    this._markers = [];
    this._markers[0] = corners.map(this._createMarker, this);
    [this._cornerMarkers] = this._markers;
    this._layer.getLatLngs()[0].forEach((latlng, index) => {
      const marker = this._cornerMarkers.find((m) => m._index === index);
      if (marker) {
        marker.setLatLng(latlng);
      }
    });
  },
  applyOptions() {
    if (this.options.snappable) {
      this._initSnappableMarkers();
    } else {
      this._disableSnapping();
    }
    this._addMarkerEvents();
  },
  // creates initial markers for coordinates
  _createMarker(latlng, index) {
    const marker = new L.Marker(latlng, {
      draggable: true,
      icon: L.divIcon({ className: "marker-icon" })
    });
    this._setPane(marker, "vertexPane");
    marker._origLatLng = latlng;
    marker._index = index;
    marker._pmTempLayer = true;
    marker.on("click", this._onVertexClick, this);
    this._markerGroup.addLayer(marker);
    return marker;
  },
  // Add marker events after adding the snapping events to the markers, beacause of the execution order
  _addMarkerEvents() {
    this._markers[0].forEach((marker) => {
      marker.on("dragstart", this._onMarkerDragStart, this);
      marker.on("drag", this._onMarkerDrag, this);
      marker.on("dragend", this._onMarkerDragEnd, this);
      if (!this.options.preventMarkerRemoval) {
        marker.on("contextmenu", this._removeMarker, this);
      }
    });
  },
  // Empty callback for 'contextmenu' binding set in L.PM.Edit.Line.js's _createMarker method (AKA, right-click on marker event)
  // (A Rectangle is designed to always remain a "true" rectangle -- if you want it editable, use Polygon Tool instead!!!)
  _removeMarker() {
    return null;
  },
  _onMarkerDragStart(e) {
    if (!this._vertexValidation("move", e)) {
      return;
    }
    const draggedMarker = e.target;
    const corners = this._cornerMarkers;
    draggedMarker._oppositeCornerLatLng = corners.find((m) => m._index === (draggedMarker._index + 2) % 4).getLatLng();
    draggedMarker._snapped = false;
    const { indexPath } = L.PM.Utils.findDeepMarkerIndex(
      this._markers,
      draggedMarker
    );
    this._fireMarkerDragStart(e, indexPath);
  },
  _onMarkerDrag(e) {
    const draggedMarker = e.target;
    if (!this._vertexValidationDrag(draggedMarker)) {
      return;
    }
    if (draggedMarker._index === void 0) {
      return;
    }
    this._adjustRectangleForMarkerMove(draggedMarker);
    const { indexPath } = L.PM.Utils.findDeepMarkerIndex(
      this._markers,
      draggedMarker
    );
    this._fireMarkerDrag(e, indexPath);
    this._fireChange(this._layer.getLatLngs(), "Edit");
  },
  _onMarkerDragEnd(e) {
    const draggedMarker = e.target;
    if (!this._vertexValidationDragEnd(draggedMarker)) {
      return;
    }
    this._cornerMarkers.forEach((m) => {
      delete m._oppositeCornerLatLng;
    });
    const { indexPath } = L.PM.Utils.findDeepMarkerIndex(
      this._markers,
      draggedMarker
    );
    this._fireMarkerDragEnd(e, indexPath);
    this._fireEdit();
    this._layerEdited = true;
    this._fireChange(this._layer.getLatLngs(), "Edit");
  },
  // adjusts the rectangle's size and bounds whenever a marker is moved
  // params: movedMarker -- the Marker object
  _adjustRectangleForMarkerMove(movedMarker) {
    L.extend(movedMarker._origLatLng, movedMarker._latlng);
    const corners = L.PM.Utils._getRotatedRectangle(
      movedMarker.getLatLng(),
      movedMarker._oppositeCornerLatLng,
      this.getAngle(),
      this._map
    );
    this._layer.setLatLngs(corners);
    this._adjustAllMarkers();
    this._layer.redraw();
  },
  // adjusts the position of all Markers
  // params: markerLatLngs -- an array of exactly LatLng objects
  _adjustAllMarkers() {
    const markerLatLngs = this._layer.getLatLngs()[0];
    if (markerLatLngs && markerLatLngs.length !== 4 && markerLatLngs.length > 0) {
      markerLatLngs.forEach((latlng, index) => {
        this._cornerMarkers[index].setLatLng(latlng);
      });
      const restMarkers = this._cornerMarkers.slice(markerLatLngs.length);
      restMarkers.forEach((marker) => {
        marker.setLatLng(markerLatLngs[0]);
      });
    } else if (!markerLatLngs || !markerLatLngs.length) {
      console.error("The layer has no LatLngs");
    } else {
      this._cornerMarkers.forEach((marker) => {
        marker.setLatLng(markerLatLngs[marker._index]);
      });
    }
  },
  // finds the 4 corners of the current bounding box
  // returns array of 4 LatLng objects in this order: Northwest corner, Northeast corner, Southeast corner, Southwest corner
  _findCorners() {
    if (this._angle === void 0) {
      this.setInitAngle(
        calcAngle(
          this._map,
          this._layer.getLatLngs()[0][0],
          this._layer.getLatLngs()[0][1]
        ) || 0
      );
    }
    const latlngs = this._layer.getLatLngs()[0];
    return L.PM.Utils._getRotatedRectangle(
      latlngs[0],
      latlngs[2],
      this.getAngle(),
      this._map || this
    );
  }
});

// L.PM.Edit.CircleMarker.js
L_PM_Edit_default.CircleMarker = L_PM_Edit_default.extend({
  _shape: "CircleMarker",
  initialize(layer) {
    this._layer = layer;
    this._enabled = false;
    this._minRadiusOption = "minRadiusCircleMarker";
    this._maxRadiusOption = "maxRadiusCircleMarker";
    this._editableOption = "resizeableCircleMarker";
    this._updateHiddenPolyCircle();
  },
  // TODO: remove default option in next major Release
  enable(options = { draggable: true, snappable: true }) {
    L.Util.setOptions(this, options);
    if (this.options.editable) {
      this.options.resizeableCircleMarker = this.options.editable;
      delete this.options.editable;
    }
    if (!this.options.allowEditing || !this._layer._map) {
      this.disable();
      return;
    }
    this._map = this._layer._map;
    if (this.enabled()) {
      this.disable();
    }
    this.applyOptions();
    this._layer.on("remove", this.disable, this);
    this._enabled = true;
    this._extendingEnable();
    this._updateHiddenPolyCircle();
    this._fireEnable();
  },
  _extendingEnable() {
    this._layer.on("pm:dragstart", this._onDragStart, this);
    this._layer.on("pm:drag", this._onMarkerDrag, this);
    this._layer.on("pm:dragend", this._onMarkerDragEnd, this);
  },
  disable() {
    if (this.dragging()) {
      return;
    }
    if (!this._map) {
      this._map = this._layer._map;
    }
    if (!this._map) {
      return;
    }
    if (!this.enabled()) {
      return;
    }
    if (this.layerDragEnabled()) {
      this.disableLayerDrag();
    }
    if (this.options[this._editableOption]) {
      if (this._helperLayers) {
        this._helperLayers.clearLayers();
      }
      this._map.off("move", this._syncMarkers, this);
      this._outerMarker.off("drag", this._handleOuterMarkerSnapping, this);
    } else {
      this._map.off("move", this._updateHiddenPolyCircle, this);
    }
    this._extendingDisable();
    this._layer.off("remove", this.disable, this);
    if (this._layerEdited) {
      this._fireUpdate();
    }
    this._layerEdited = false;
    this._fireDisable();
    this._enabled = false;
  },
  _extendingDisable() {
    this._layer.off("contextmenu", this._removeMarker, this);
  },
  enabled() {
    return this._enabled;
  },
  toggleEdit(options) {
    if (!this.enabled()) {
      this.enable(options);
    } else {
      this.disable();
    }
  },
  applyOptions() {
    if (this.options[this._editableOption]) {
      this._initMarkers();
      this._map.on("move", this._syncMarkers, this);
      if (this.options.snappable) {
        this._initSnappableMarkers();
        this._outerMarker.on("drag", this._handleOuterMarkerSnapping, this);
        this._outerMarker.on("move", this._syncHintLine, this);
        this._outerMarker.on("move", this._syncCircleRadius, this);
        this._centerMarker.on("move", this._moveCircle, this);
      } else {
        this._disableSnapping();
      }
    } else {
      if (this.options.draggable) {
        this.enableLayerDrag();
      }
      this._map.on("move", this._updateHiddenPolyCircle, this);
      if (this.options.snappable) {
        this._initSnappableMarkersDrag();
      } else {
        this._disableSnappingDrag();
      }
    }
    this._extendingApplyOptions();
  },
  _extendingApplyOptions() {
    if (!this.options.preventMarkerRemoval) {
      this._layer.on("contextmenu", this._removeMarker, this);
    }
  },
  _initMarkers() {
    const map = this._map;
    if (this._helperLayers) {
      this._helperLayers.clearLayers();
    }
    this._helperLayers = new L.FeatureGroup();
    this._helperLayers._pmTempLayer = true;
    this._helperLayers.addTo(map);
    const center = this._layer.getLatLng();
    const radius = this._layer._radius;
    const outer = this._getLatLngOnCircle(center, radius);
    this._centerMarker = this._createCenterMarker(center);
    this._outerMarker = this._createOuterMarker(outer);
    this._markers = [this._centerMarker, this._outerMarker];
    this._createHintLine(this._centerMarker, this._outerMarker);
  },
  _getLatLngOnCircle(center, radius) {
    const pointA = this._map.project(center);
    const pointB = L.point(pointA.x + radius, pointA.y);
    return this._map.unproject(pointB);
  },
  _createHintLine(markerA, markerB) {
    const A = markerA.getLatLng();
    const B = markerB.getLatLng();
    this._hintline = L.polyline([A, B], this.options.hintlineStyle);
    this._setPane(this._hintline, "layerPane");
    this._hintline._pmTempLayer = true;
    this._helperLayers.addLayer(this._hintline);
  },
  _createCenterMarker(latlng) {
    const marker = this._createMarker(latlng);
    if (this.options.draggable) {
      L.DomUtil.addClass(marker._icon, "leaflet-pm-draggable");
    } else {
      marker.dragging.disable();
    }
    return marker;
  },
  _createOuterMarker(latlng) {
    const marker = this._createMarker(latlng);
    marker.on("drag", this._resizeCircle, this);
    return marker;
  },
  _createMarker(latlng) {
    const marker = new L.Marker(latlng, {
      draggable: true,
      icon: L.divIcon({ className: "marker-icon" })
    });
    this._setPane(marker, "vertexPane");
    marker._origLatLng = latlng;
    marker._pmTempLayer = true;
    marker.on("dragstart", this._onMarkerDragStart, this);
    marker.on("drag", this._onMarkerDrag, this);
    marker.on("dragend", this._onMarkerDragEnd, this);
    marker.on("click", this._onVertexClick, this);
    this._helperLayers.addLayer(marker);
    return marker;
  },
  _moveCircle(e) {
    const draggedMarker = e.target;
    if (draggedMarker._cancelDragEventChain) {
      return;
    }
    const center = this._centerMarker.getLatLng();
    this._layer.setLatLng(center);
    const radius = this._layer._radius;
    const outer = this._getLatLngOnCircle(center, radius);
    this._outerMarker._latlng = outer;
    this._outerMarker.update();
    this._syncHintLine();
    this._updateHiddenPolyCircle();
    this._fireCenterPlaced("Edit");
    this._fireChange(this._layer.getLatLng(), "Edit");
  },
  _syncMarkers() {
    const center = this._layer.getLatLng();
    const radius = this._layer._radius;
    const outer = this._getLatLngOnCircle(center, radius);
    this._outerMarker.setLatLng(outer);
    this._centerMarker.setLatLng(center);
    this._syncHintLine();
    this._updateHiddenPolyCircle();
  },
  _resizeCircle() {
    this._outerMarker.setLatLng(this._getNewDestinationOfOuterMarker());
    this._syncHintLine();
    this._syncCircleRadius();
  },
  _syncCircleRadius() {
    const A = this._centerMarker.getLatLng();
    const B = this._outerMarker.getLatLng();
    const distance = this._distanceCalculation(A, B);
    if (this.options[this._minRadiusOption] && distance < this.options[this._minRadiusOption]) {
      this._layer.setRadius(this.options[this._minRadiusOption]);
    } else if (this.options[this._maxRadiusOption] && distance > this.options[this._maxRadiusOption]) {
      this._layer.setRadius(this.options[this._maxRadiusOption]);
    } else {
      this._layer.setRadius(distance);
    }
    this._updateHiddenPolyCircle();
    this._fireChange(this._layer.getLatLng(), "Edit");
  },
  _syncHintLine() {
    const A = this._centerMarker.getLatLng();
    const B = this._outerMarker.getLatLng();
    this._hintline.setLatLngs([A, B]);
  },
  _removeMarker() {
    if (this.options[this._editableOption]) {
      this.disable();
    }
    this._layer.remove();
    this._fireRemove(this._layer);
    this._fireRemove(this._map, this._layer);
  },
  _onDragStart() {
    this._map.pm.Draw.CircleMarker._layerIsDragging = true;
  },
  _onMarkerDragStart(e) {
    if (!this._vertexValidation("move", e)) {
      return;
    }
    this._fireMarkerDragStart(e);
  },
  _onMarkerDrag(e) {
    const draggedMarker = e.target;
    if (draggedMarker instanceof L.Marker && !this._vertexValidationDrag(draggedMarker)) {
      return;
    }
    this._fireMarkerDrag(e);
  },
  _onMarkerDragEnd(e) {
    this._extedingMarkerDragEnd();
    const draggedMarker = e.target;
    if (!this._vertexValidationDragEnd(draggedMarker)) {
      return;
    }
    if (this.options[this._editableOption]) {
      this._fireEdit();
      this._layerEdited = true;
    }
    this._fireMarkerDragEnd(e);
  },
  _extedingMarkerDragEnd() {
    this._map.pm.Draw.CircleMarker._layerIsDragging = false;
  },
  // _initSnappableMarkers when option editable is not true
  _initSnappableMarkersDrag() {
    const marker = this._layer;
    this.options.snapDistance = this.options.snapDistance || 30;
    this.options.snapSegment = this.options.snapSegment === void 0 ? true : this.options.snapSegment;
    marker.off("pm:drag", this._handleSnapping, this);
    marker.on("pm:drag", this._handleSnapping, this);
    marker.off("pm:dragend", this._cleanupSnapping, this);
    marker.on("pm:dragend", this._cleanupSnapping, this);
    marker.off("pm:dragstart", this._unsnap, this);
    marker.on("pm:dragstart", this._unsnap, this);
  },
  // _disableSnapping when option editable is not true
  _disableSnappingDrag() {
    const marker = this._layer;
    marker.off("pm:drag", this._handleSnapping, this);
    marker.off("pm:dragend", this._cleanupSnapping, this);
    marker.off("pm:dragstart", this._unsnap, this);
  },
  _updateHiddenPolyCircle() {
    const map = this._layer._map || this._map;
    if (map) {
      const radius = L.PM.Utils.pxRadiusToMeterRadius(
        this._layer.getRadius(),
        map,
        this._layer.getLatLng()
      );
      const _layer = L.circle(this._layer.getLatLng(), this._layer.options);
      _layer.setRadius(radius);
      const crsSimple = map && map.pm._isCRSSimple();
      if (this._hiddenPolyCircle) {
        this._hiddenPolyCircle.setLatLngs(
          L.PM.Utils.circleToPolygon(_layer, 200, !crsSimple).getLatLngs()
        );
      } else {
        this._hiddenPolyCircle = L.PM.Utils.circleToPolygon(
          _layer,
          200,
          !crsSimple
        );
      }
      if (!this._hiddenPolyCircle._parentCopy) {
        this._hiddenPolyCircle._parentCopy = this._layer;
      }
    }
  },
  _getNewDestinationOfOuterMarker() {
    const latlng = this._centerMarker.getLatLng();
    let secondLatLng = this._outerMarker.getLatLng();
    const distance = this._distanceCalculation(latlng, secondLatLng);
    if (this.options[this._minRadiusOption] && distance < this.options[this._minRadiusOption]) {
      secondLatLng = destinationOnLine(
        this._map,
        latlng,
        secondLatLng,
        this._getMinDistanceInMeter(latlng)
      );
    } else if (this.options[this._maxRadiusOption] && distance > this.options[this._maxRadiusOption]) {
      secondLatLng = destinationOnLine(
        this._map,
        latlng,
        secondLatLng,
        this._getMaxDistanceInMeter(latlng)
      );
    }
    return secondLatLng;
  },
  _handleOuterMarkerSnapping() {
    if (this._outerMarker._snapped) {
      const latlng = this._centerMarker.getLatLng();
      const secondLatLng = this._outerMarker.getLatLng();
      const distance = this._distanceCalculation(latlng, secondLatLng);
      if (this.options[this._minRadiusOption] && distance < this.options[this._minRadiusOption]) {
        this._outerMarker.setLatLng(this._outerMarker._orgLatLng);
      } else if (this.options[this._maxRadiusOption] && distance > this.options[this._maxRadiusOption]) {
        this._outerMarker.setLatLng(this._outerMarker._orgLatLng);
      }
    }
    this._outerMarker.setLatLng(this._getNewDestinationOfOuterMarker());
  },
  _distanceCalculation(A, B) {
    return this._map.project(A).distanceTo(this._map.project(B));
  },
  _getMinDistanceInMeter(latlng) {
    return L.PM.Utils.pxRadiusToMeterRadius(
      this.options[this._minRadiusOption],
      this._map,
      latlng
    );
  },
  _getMaxDistanceInMeter(latlng) {
    return L.PM.Utils.pxRadiusToMeterRadius(
      this.options[this._maxRadiusOption],
      this._map,
      latlng
    );
  },
  _onVertexClick(e) {
    const vertex = e.target;
    if (vertex._dragging) {
      return;
    }
    this._fireVertexClick(e, void 0);
  }
});

// L.PM.Edit.Circle.js
L_PM_Edit_default.Circle = L_PM_Edit_default.CircleMarker.extend({
  _shape: "Circle",
  initialize(layer) {
    this._layer = layer;
    this._enabled = false;
    this._minRadiusOption = "minRadiusCircle";
    this._maxRadiusOption = "maxRadiusCircle";
    this._editableOption = "resizeableCircle";
    this._updateHiddenPolyCircle();
  },
  enable(options) {
    L.PM.Edit.CircleMarker.prototype.enable.call(this, options || {});
  },
  _extendingEnable() {
  },
  _extendingDisable() {
    this._layer.off("remove", this.disable, this);
    const el = this._layer._path ? this._layer._path : this._layer._renderer._container;
    L.DomUtil.removeClass(el, "leaflet-pm-draggable");
  },
  _extendingApplyOptions() {
  },
  _syncMarkers() {
  },
  _removeMarker() {
  },
  _onDragStart() {
  },
  _extedingMarkerDragEnd() {
  },
  _updateHiddenPolyCircle() {
    const crsSimple = this._map && this._map.pm._isCRSSimple();
    if (this._hiddenPolyCircle) {
      this._hiddenPolyCircle.setLatLngs(
        L.PM.Utils.circleToPolygon(this._layer, 200, !crsSimple).getLatLngs()
      );
    } else {
      this._hiddenPolyCircle = L.PM.Utils.circleToPolygon(
        this._layer,
        200,
        !crsSimple
      );
    }
    if (!this._hiddenPolyCircle._parentCopy) {
      this._hiddenPolyCircle._parentCopy = this._layer;
    }
  },
  _distanceCalculation(A, B) {
    return this._map.distance(A, B);
  },
  _getMinDistanceInMeter() {
    return this.options[this._minRadiusOption];
  },
  _getMaxDistanceInMeter() {
    return this.options[this._maxRadiusOption];
  },
  _onVertexClick(e) {
    const vertex = e.target;
    if (vertex._dragging) {
      return;
    }
    this._fireVertexClick(e, void 0);
  }
});

// L.PM.Edit.ImageOverlay.js
L_PM_Edit_default.ImageOverlay = L_PM_Edit_default.extend({
  _shape: "ImageOverlay",
  initialize(layer) {
    this._layer = layer;
    this._enabled = false;
  },
  toggleEdit(options) {
    if (!this.enabled()) {
      this.enable(options);
    } else {
      this.disable();
    }
  },
  enabled() {
    return this._enabled;
  },
  // TODO: remove default option in next major Release
  enable(options = { draggable: true, snappable: true }) {
    L.Util.setOptions(this, options);
    this._map = this._layer._map;
    if (!this._map) {
      return;
    }
    if (!this.options.allowEditing) {
      this.disable();
      return;
    }
    if (!this.enabled()) {
      this.disable();
    }
    this.enableLayerDrag();
    this._layer.on("remove", this.disable, this);
    this._enabled = true;
    this._otherSnapLayers = this._findCorners();
    this._fireEnable();
  },
  disable() {
    if (this._dragging) {
      return;
    }
    if (!this._map) {
      this._map = this._layer._map;
    }
    this.disableLayerDrag();
    this._layer.off("remove", this.disable, this);
    if (!this.enabled()) {
      if (this._layerEdited) {
        this._fireUpdate();
      }
      this._layerEdited = false;
      this._fireDisable();
    }
    this._enabled = false;
  },
  _findCorners() {
    const corners = this._layer.getBounds();
    const northwest = corners.getNorthWest();
    const northeast = corners.getNorthEast();
    const southeast = corners.getSouthEast();
    const southwest = corners.getSouthWest();
    return [northwest, northeast, southeast, southwest];
  }
});

// L.PM.Edit.Text.js
L_PM_Edit_default.Text = L_PM_Edit_default.extend({
  _shape: "Text",
  initialize(layer) {
    this._layer = layer;
    this._enabled = false;
  },
  enable(options) {
    L.Util.setOptions(this, options);
    if (!this.textArea) {
      return;
    }
    if (!this.options.allowEditing || !this._layer._map) {
      this.disable();
      return;
    }
    this._map = this._layer._map;
    if (this.enabled()) {
      this.disable();
    }
    this.applyOptions();
    this._safeToCacheDragState = true;
    this._focusChange();
    this.textArea.readOnly = false;
    this.textArea.classList.remove("pm-disabled");
    this._layer.on("remove", this.disable, this);
    L.DomEvent.on(this.textArea, "input", this._autoResize, this);
    L.DomEvent.on(this.textArea, "focus", this._focusChange, this);
    L.DomEvent.on(this.textArea, "blur", this._focusChange, this);
    this._layer.on("dblclick", L.DomEvent.stop);
    L.DomEvent.off(this.textArea, "mousedown", this._preventTextSelection);
    this._enabled = true;
    this._fireEnable();
  },
  disable() {
    if (!this.enabled()) {
      return;
    }
    this._layer.off("remove", this.disable, this);
    L.DomEvent.off(this.textArea, "input", this._autoResize, this);
    L.DomEvent.off(this.textArea, "focus", this._focusChange, this);
    L.DomEvent.off(this.textArea, "blur", this._focusChange, this);
    L.DomEvent.off(document, "click", this._documentClick, this);
    this._focusChange();
    this.textArea.readOnly = true;
    this.textArea.classList.add("pm-disabled");
    const focusedElement = document.activeElement;
    this.textArea.focus();
    this.textArea.selectionStart = 0;
    this.textArea.selectionEnd = 0;
    L.DomEvent.on(this.textArea, "mousedown", this._preventTextSelection);
    focusedElement.focus();
    this._disableOnBlurActive = false;
    if (this._layerEdited) {
      this._fireUpdate();
    }
    this._layerEdited = false;
    this._fireDisable();
    this._enabled = false;
  },
  enabled() {
    return this._enabled;
  },
  toggleEdit(options) {
    if (!this.enabled()) {
      this.enable(options);
    } else {
      this.disable();
    }
  },
  applyOptions() {
    if (this.options.snappable) {
      this._initSnappableMarkers();
    } else {
      this._disableSnapping();
    }
  },
  // overwrite initSnappableMarkers from Snapping.js Mixin
  _initSnappableMarkers() {
    const marker = this._layer;
    this.options.snapDistance = this.options.snapDistance || 30;
    this.options.snapSegment = this.options.snapSegment === void 0 ? true : this.options.snapSegment;
    marker.off("pm:drag", this._handleSnapping, this);
    marker.on("pm:drag", this._handleSnapping, this);
    marker.off("pm:dragend", this._cleanupSnapping, this);
    marker.on("pm:dragend", this._cleanupSnapping, this);
    marker.off("pm:dragstart", this._unsnap, this);
    marker.on("pm:dragstart", this._unsnap, this);
  },
  _disableSnapping() {
    const marker = this._layer;
    marker.off("pm:drag", this._handleSnapping, this);
    marker.off("pm:dragend", this._cleanupSnapping, this);
    marker.off("pm:dragstart", this._unsnap, this);
  },
  _autoResize() {
    this.textArea.style.height = "1px";
    this.textArea.style.width = "1px";
    const height = this.textArea.scrollHeight > 21 ? this.textArea.scrollHeight : 21;
    const width = this.textArea.scrollWidth > 16 ? this.textArea.scrollWidth : 16;
    this.textArea.style.height = `${height}px`;
    this.textArea.style.width = `${width}px`;
    this._layer.options.text = this.getText();
    this._fireTextChange(this.getText());
  },
  _disableOnBlur() {
    this._disableOnBlurActive = true;
    setTimeout(() => {
      if (this.enabled()) {
        L.DomEvent.on(document, "click", this._documentClick, this);
      }
    }, 100);
  },
  _documentClick(e) {
    if (e.target !== this.textArea) {
      this.disable();
      if (!this.getText() && this.options.removeIfEmpty) {
        this.remove();
      }
    }
  },
  _focusChange(e = {}) {
    const focusAlreadySet = this._hasFocus;
    this._hasFocus = e.type === "focus";
    if (!focusAlreadySet !== !this._hasFocus) {
      if (this._hasFocus) {
        this._applyFocus();
        this._focusText = this.getText();
        this._fireTextFocus();
      } else {
        this._removeFocus();
        this._fireTextBlur();
        if (this._focusText !== this.getText()) {
          this._fireEdit();
          this._layerEdited = true;
        }
      }
    }
  },
  _applyFocus() {
    this.textArea.classList.add("pm-hasfocus");
    if (this._map.dragging) {
      if (this._safeToCacheDragState) {
        this._originalMapDragState = this._map.dragging._enabled;
        this._safeToCacheDragState = false;
      }
      this._map.dragging.disable();
    }
  },
  _removeFocus() {
    if (this._map.dragging) {
      if (this._originalMapDragState) {
        this._map.dragging.enable();
      }
      this._safeToCacheDragState = true;
    }
    this.textArea.classList.remove("pm-hasfocus");
  },
  focus() {
    if (!this.enabled()) {
      throw new TypeError("Layer is not enabled");
    }
    this.textArea.focus();
  },
  blur() {
    if (!this.enabled()) {
      throw new TypeError("Layer is not enabled");
    }
    this.textArea.blur();
    if (this._disableOnBlurActive) {
      this.disable();
    }
  },
  hasFocus() {
    return this._hasFocus;
  },
  getElement() {
    return this.textArea;
  },
  setText(text) {
    this.textArea.value = text;
    this._autoResize();
  },
  getText() {
    return this.textArea.value;
  },
  _initTextMarker() {
    this.textArea = L.PM.Draw.Text.prototype._createTextArea.call(this);
    if (this.options.className) {
      const cssClasses = this.options.className.split(" ");
      this.textArea.classList.add(...cssClasses);
    }
    const textAreaIcon = L.PM.Draw.Text.prototype._createTextIcon.call(
      this,
      this.textArea
    );
    this._layer.setIcon(textAreaIcon);
    this._layer.once("add", this._createTextMarker, this);
  },
  _createTextMarker(enable = false) {
    this._layer.off("add", this._createTextMarker, this);
    this._layer.getElement().tabIndex = -1;
    this.textArea.wrap = "off";
    this.textArea.style.overflow = "hidden";
    this.textArea.style.height = L.DomUtil.getStyle(this.textArea, "font-size");
    this.textArea.style.width = "1px";
    if (this._layer.options.text) {
      this.setText(this._layer.options.text);
    }
    this._autoResize();
    if (enable === true) {
      this.enable();
      this.focus();
      this._disableOnBlur();
    }
  },
  // Chrome ignores `user-select: none`, so we need to disable text selection manually
  _preventTextSelection(e) {
    e.preventDefault();
  }
});

// Matrix.js
var Matrix = function Matrix2(a, b, c, d, e, f) {
  this._matrix = [a, b, c, d, e, f];
};
Matrix.init = () => new L.PM.Matrix(1, 0, 0, 1, 0, 0);
Matrix.prototype = {
  /**
   * @param  {L.Point} point
   * @return {L.Point}
   */
  transform(point) {
    return this._transform(point.clone());
  },
  /**
   * Destructive
   *
   * [ x ] = [ a  b  tx ] [ x ] = [ a * x + b * y + tx ]
   * [ y ] = [ c  d  ty ] [ y ] = [ c * x + d * y + ty ]
   *
   * @param  {L.Point} point
   * @return {L.Point}
   */
  _transform(point) {
    const matrix = this._matrix;
    const { x, y } = point;
    point.x = matrix[0] * x + matrix[1] * y + matrix[4];
    point.y = matrix[2] * x + matrix[3] * y + matrix[5];
    return point;
  },
  /**
   * @param  {L.Point} point
   * @return {L.Point}
   */
  untransform(point) {
    const matrix = this._matrix;
    return new L.Point(
      (point.x / matrix[0] - matrix[4]) / matrix[0],
      (point.y / matrix[2] - matrix[5]) / matrix[2]
    );
  },
  /**
   * @return {L.PM.Matrix}
   */
  clone() {
    const matrix = this._matrix;
    return new L.PM.Matrix(
      matrix[0],
      matrix[1],
      matrix[2],
      matrix[3],
      matrix[4],
      matrix[5]
    );
  },
  /**
   * @param {L.Point|Number} translate
   * @return {L.PM.Matrix|L.Point}
   */
  translate(translate) {
    if (translate === void 0) {
      return new L.Point(this._matrix[4], this._matrix[5]);
    }
    let translateX;
    let translateY;
    if (typeof translate === "number") {
      translateX = translate;
      translateY = translate;
    } else {
      translateX = translate.x;
      translateY = translate.y;
    }
    return this._add(1, 0, 0, 1, translateX, translateY);
  },
  /**
   * @param {L.Point|Number} scale
   * @param {L.Point|Number} origin
   * @return {L.PM.Matrix|L.Point}
   */
  scale(scale, origin) {
    if (scale === void 0) {
      return new L.Point(this._matrix[0], this._matrix[3]);
    }
    let scaleX;
    let scaleY;
    origin = origin || L.point(0, 0);
    if (typeof scale === "number") {
      scaleX = scale;
      scaleY = scale;
    } else {
      scaleX = scale.x;
      scaleY = scale.y;
    }
    return this._add(scaleX, 0, 0, scaleY, origin.x, origin.y)._add(
      1,
      0,
      0,
      1,
      -origin.x,
      -origin.y
    );
  },
  /**
   * m00  m01  x - m00 * x - m01 * y
   * m10  m11  y - m10 * x - m11 * y
   * @param {Number}   angle
   * @param {L.Point=} origin
   * @return {L.PM.Matrix}
   */
  rotate(angle, origin) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    origin = origin || new L.Point(0, 0);
    return this._add(cos, sin, -sin, cos, origin.x, origin.y)._add(
      1,
      0,
      0,
      1,
      -origin.x,
      -origin.y
    );
  },
  /**
   * Invert rotation
   * @return {L.PM.Matrix}
   */
  flip() {
    this._matrix[1] *= -1;
    this._matrix[2] *= -1;
    return this;
  },
  /**
   * @param {Number|L.PM.Matrix} a
   * @param {Number} b
   * @param {Number} c
   * @param {Number} d
   * @param {Number} e
   * @param {Number} f
   */
  _add(a, b, c, d, e, f) {
    const result = [[], [], []];
    let src = this._matrix;
    const m = [
      [src[0], src[2], src[4]],
      [src[1], src[3], src[5]],
      [0, 0, 1]
    ];
    let other = [
      [a, c, e],
      [b, d, f],
      [0, 0, 1]
    ];
    let val;
    if (a && a instanceof L.PM.Matrix) {
      src = a._matrix;
      other = [
        [src[0], src[2], src[4]],
        [src[1], src[3], src[5]],
        [0, 0, 1]
      ];
    }
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        val = 0;
        for (let k = 0; k < 3; k += 1) {
          val += m[i][k] * other[k][j];
        }
        result[i][j] = val;
      }
    }
    this._matrix = [
      result[0][0],
      result[1][0],
      result[0][1],
      result[1][1],
      result[0][2],
      result[1][2]
    ];
    return this;
  }
};
var Matrix_default = Matrix;

// L.PM.Utils.js
var Utils = {
  calcMiddleLatLng(map, latlng1, latlng2) {
    const p1 = map.project(latlng1);
    const p2 = map.project(latlng2);
    return map.unproject(p1._add(p2)._divideBy(2));
  },
  findLayers(map) {
    let layers = [];
    map.eachLayer((layer) => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.CircleMarker || layer instanceof L.ImageOverlay) {
        layers.push(layer);
      }
    });
    layers = layers.filter((layer) => !!layer.pm);
    layers = layers.filter((layer) => !layer._pmTempLayer);
    layers = layers.filter(
      (layer) => !L.PM.optIn && !layer.options.pmIgnore || // if optIn is not set / true and pmIgnore is not set / true (default)
        L.PM.optIn && layer.options.pmIgnore === false
      // if optIn is true and pmIgnore is false);
    );
    return layers;
  },
  circleToPolygon(circle, sides = 60, withBearing = true) {
    const origin = circle.getLatLng();
    const radius = circle.getRadius();
    const polys = createGeodesicPolygon(origin, radius, sides, 0, withBearing);
    const polygon = [];
    for (let i = 0; i < polys.length; i += 1) {
      const geometry = [polys[i].lat, polys[i].lng];
      polygon.push(geometry);
    }
    return L.polygon(polygon, circle.options);
  },
  disablePopup(layer) {
    if (layer.getPopup()) {
      layer._tempPopupCopy = layer.getPopup();
      layer.unbindPopup();
    }
  },
  enablePopup(layer) {
    if (layer._tempPopupCopy) {
      layer.bindPopup(layer._tempPopupCopy);
      delete layer._tempPopupCopy;
    }
  },
  _fireEvent(layer, type, data, propagate = false) {
    layer.fire(type, data, propagate);
    const { groups } = this.getAllParentGroups(layer);
    groups.forEach((group) => {
      group.fire(type, data, propagate);
    });
  },
  getAllParentGroups(layer) {
    const groupIds = [];
    const groups = [];
    const loopThroughParents = (_layer) => {
      for (const _id in _layer._eventParents) {
        if (groupIds.indexOf(_id) === -1) {
          groupIds.push(_id);
          const group = _layer._eventParents[_id];
          groups.push(group);
          loopThroughParents(group);
        }
      }
    };
    if (!layer._pmLastGroupFetch || !layer._pmLastGroupFetch.time || (/* @__PURE__ */ new Date()).getTime() - layer._pmLastGroupFetch.time > 1e3) {
      loopThroughParents(layer);
      layer._pmLastGroupFetch = {
        time: (/* @__PURE__ */ new Date()).getTime(),
        groups,
        groupIds
      };
      return {
        groupIds,
        groups
      };
    }
    return {
      groups: layer._pmLastGroupFetch.groups,
      groupIds: layer._pmLastGroupFetch.groupIds
    };
  },
  createGeodesicPolygon,
  getTranslation,
  findDeepCoordIndex(arr, latlng, exact = true) {
    let result;
    const run = (path) => (v, i) => {
      const iRes = path.concat(i);
      if (exact) {
        if (v.lat && v.lat === latlng.lat && v.lng === latlng.lng) {
          result = iRes;
          return true;
        }
      } else if (v.lat && L.latLng(v).equals(latlng)) {
        result = iRes;
        return true;
      }
      return Array.isArray(v) && v.some(run(iRes));
    };
    arr.some(run([]));
    let returnVal = {};
    if (result) {
      returnVal = {
        indexPath: result,
        index: result[result.length - 1],
        parentPath: result.slice(0, result.length - 1)
      };
    }
    return returnVal;
  },
  findDeepMarkerIndex(arr, marker) {
    let result;
    const run = (path) => (v, i) => {
      const iRes = path.concat(i);
      if (v._leaflet_id === marker._leaflet_id) {
        result = iRes;
        return true;
      }
      return Array.isArray(v) && v.some(run(iRes));
    };
    arr.some(run([]));
    let returnVal = {};
    if (result) {
      returnVal = {
        indexPath: result,
        index: result[result.length - 1],
        parentPath: result.slice(0, result.length - 1)
      };
    }
    return returnVal;
  },
  _getIndexFromSegment(coords, segment) {
    if (segment && segment.length === 2) {
      const indexA = this.findDeepCoordIndex(coords, segment[0]);
      const indexB = this.findDeepCoordIndex(coords, segment[1]);
      let newIndex = Math.max(indexA.index, indexB.index);
      if ((indexA.index === 0 || indexB.index === 0) && newIndex !== 1) {
        newIndex += 1;
      }
      return {
        indexA,
        indexB,
        newIndex,
        indexPath: indexA.indexPath,
        parentPath: indexA.parentPath
      };
    }
    return null;
  },
  // Returns the corners of the rectangle with a given rotation
  // degrees: Between marker A and the marker counterclockwise before. Same for marker B
  _getRotatedRectangle(A, B, rotation, map) {
    const startPoint = _toPoint(map, A);
    const endPoint = _toPoint(map, B);
    const theta = rotation * Math.PI / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const width = (endPoint.x - startPoint.x) * cos + (endPoint.y - startPoint.y) * sin;
    const height = (endPoint.y - startPoint.y) * cos - (endPoint.x - startPoint.x) * sin;
    const x0 = width * cos + startPoint.x;
    const y0 = width * sin + startPoint.y;
    const x1 = -height * sin + startPoint.x;
    const y1 = height * cos + startPoint.y;
    const p0 = _toLatLng(map, startPoint);
    const p1 = _toLatLng(map, { x: x0, y: y0 });
    const p2 = _toLatLng(map, endPoint);
    const p3 = _toLatLng(map, { x: x1, y: y1 });
    return [p0, p1, p2, p3];
  },
  pxRadiusToMeterRadius(radiusInPx, map, center) {
    const pointA = map.project(center);
    const pointB = L.point(pointA.x + radiusInPx, pointA.y);
    return map.distance(map.unproject(pointB), center);
  }
};
var L_PM_Utils_default = Utils;

// L.PM.js
// eslint-disable-next-line no-import-assign
L.PM = L.PM || {
  Map: L_PM_Map_default,
  Toolbar: L_PM_Toolbar_default,
  Draw: L_PM_Draw_default,
  Edit: L_PM_Edit_default,
  Utils: L_PM_Utils_default,
  Matrix: Matrix_default,
  activeLang: "en",
  optIn: false,
  initialize(options) {
    this.addInitHooks(options);
  },
  setOptIn(value) {
    this.optIn = !!value;
  },
  addInitHooks() {
    function initMap() {
      this.pm = void 0;
      if (L.PM.optIn) {
        if (this.options.pmIgnore === false) {
          this.pm = new L.PM.Map(this);
        }
      } else if (!this.options.pmIgnore) {
        this.pm = new L.PM.Map(this);
      }
      if (this.pm) {
        this.pm.setGlobalOptions({});
      }
    }
    L.Map.addInitHook(initMap);
    function initLayerGroup() {
      this.pm = void 0;
      if (L.PM.optIn) {
        if (this.options.pmIgnore === false) {
          this.pm = new L.PM.Edit.LayerGroup(this);
        }
      } else if (!this.options.pmIgnore) {
        this.pm = new L.PM.Edit.LayerGroup(this);
      }
    }
    L.LayerGroup.addInitHook(initLayerGroup);
    function initMarker() {
      this.pm = void 0;
      if (L.PM.optIn) {
        if (this.options.pmIgnore === false) {
          if (this.options.textMarker) {
            this.pm = new L.PM.Edit.Text(this);
            if (!this.options._textMarkerOverPM) {
              this.pm._initTextMarker();
            }
            delete this.options._textMarkerOverPM;
          } else {
            this.pm = new L.PM.Edit.Marker(this);
          }
        }
      } else if (!this.options.pmIgnore) {
        if (this.options.textMarker) {
          this.pm = new L.PM.Edit.Text(this);
          if (!this.options._textMarkerOverPM) {
            this.pm._initTextMarker();
          }
          delete this.options._textMarkerOverPM;
        } else {
          this.pm = new L.PM.Edit.Marker(this);
        }
      }
    }
    L.Marker.addInitHook(initMarker);
    function initCircleMarker() {
      this.pm = void 0;
      if (L.PM.optIn) {
        if (this.options.pmIgnore === false) {
          this.pm = new L.PM.Edit.CircleMarker(this);
        }
      } else if (!this.options.pmIgnore) {
        this.pm = new L.PM.Edit.CircleMarker(this);
      }
    }
    L.CircleMarker.addInitHook(initCircleMarker);
    function initPolyline() {
      this.pm = void 0;
      if (L.PM.optIn) {
        if (this.options.pmIgnore === false) {
          this.pm = new L.PM.Edit.Line(this);
        }
      } else if (!this.options.pmIgnore) {
        this.pm = new L.PM.Edit.Line(this);
      }
    }
    L.Polyline.addInitHook(initPolyline);
    function initPolygon() {
      this.pm = void 0;
      if (L.PM.optIn) {
        if (this.options.pmIgnore === false) {
          this.pm = new L.PM.Edit.Polygon(this);
        }
      } else if (!this.options.pmIgnore) {
        this.pm = new L.PM.Edit.Polygon(this);
      }
    }
    L.Polygon.addInitHook(initPolygon);
    function initRectangle() {
      this.pm = void 0;
      if (L.PM.optIn) {
        if (this.options.pmIgnore === false) {
          this.pm = new L.PM.Edit.Rectangle(this);
        }
      } else if (!this.options.pmIgnore) {
        this.pm = new L.PM.Edit.Rectangle(this);
      }
    }
    L.Rectangle.addInitHook(initRectangle);
    function initCircle() {
      this.pm = void 0;
      if (L.PM.optIn) {
        if (this.options.pmIgnore === false) {
          this.pm = new L.PM.Edit.Circle(this);
        }
      } else if (!this.options.pmIgnore) {
        this.pm = new L.PM.Edit.Circle(this);
      }
    }
    L.Circle.addInitHook(initCircle);
    function initImageOverlay() {
      this.pm = void 0;
      if (L.PM.optIn) {
        if (this.options.pmIgnore === false) {
          this.pm = new L.PM.Edit.ImageOverlay(this);
        }
      } else if (!this.options.pmIgnore) {
        this.pm = new L.PM.Edit.ImageOverlay(this);
      }
    }
    L.ImageOverlay.addInitHook(initImageOverlay);
  },
  reInitLayer(layer) {
    if (layer instanceof L.LayerGroup) {
      layer.eachLayer((_layer) => {
        this.reInitLayer(_layer);
      });
    }
    if (layer.pm) { /* empty */ } else if (L.PM.optIn && layer.options.pmIgnore !== false) { /* empty */ } else if (layer.options.pmIgnore) { /* empty */ } else if (layer instanceof L.Map) {
      layer.pm = new L.PM.Map(layer);
    } else if (layer instanceof L.Marker) {
      if (layer.options.textMarker) {
        layer.pm = new L.PM.Edit.Text(layer);
        layer.pm._initTextMarker();
        layer.pm._createTextMarker(false);
      } else {
        layer.pm = new L.PM.Edit.Marker(layer);
      }
    } else if (layer instanceof L.Circle) {
      layer.pm = new L.PM.Edit.Circle(layer);
    } else if (layer instanceof L.CircleMarker) {
      layer.pm = new L.PM.Edit.CircleMarker(layer);
    } else if (layer instanceof L.Rectangle) {
      layer.pm = new L.PM.Edit.Rectangle(layer);
    } else if (layer instanceof L.Polygon) {
      layer.pm = new L.PM.Edit.Polygon(layer);
    } else if (layer instanceof L.Polyline) {
      layer.pm = new L.PM.Edit.Line(layer);
    } else if (layer instanceof L.LayerGroup) {
      layer.pm = new L.PM.Edit.LayerGroup(layer);
    } else if (layer instanceof L.ImageOverlay) {
      layer.pm = new L.PM.Edit.ImageOverlay(layer);
    }
  }
};
if (L.version === "1.7.1") {
  L.Canvas.include({
    _onClick(e) {
      const point = this._map.mouseEventToLayerPoint(e);
      let layer;
      let clickedLayer;
      for (let order = this._drawFirst; order; order = order.next) {
        layer = order.layer;
        if (layer.options.interactive && layer._containsPoint(point)) {
          if (!(e.type === "click" || e.type === "preclick") || !this._map._draggableMoved(layer)) {
            clickedLayer = layer;
          }
        }
      }
      if (clickedLayer) {
        L.DomEvent.fakeStop(e);
        this._fireEvent([clickedLayer], e);
      }
    }
  });
}
L.PM.initialize();
export default L;

