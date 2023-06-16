/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as Vector from "esri-leaflet-vector";
import {
  type LayerProps,
  createLayerComponent,
  type LeafletContextInterface,
  type LeafletElement,
} from "@react-leaflet/core";

export type VectorBasemapLayerProps = {
  styleKey: string;
  apiKey: string;
  style?: unknown
} & LayerProps;

const createVectorBasemapLayer = ({ styleKey, ...props }: VectorBasemapLayerProps, context: LeafletContextInterface) => {
  return {
    instance: Vector.vectorBasemapLayer(styleKey, { ...props }),
    context,
  };
};

const updateVectorBasemapLayer = (
  _instance: LeafletElement<ReturnType<typeof Vector.vectorBasemapLayer>>,
  _props: VectorBasemapLayerProps,
  _prevProps: VectorBasemapLayerProps
) => {
  // TODO: Do I nede to do anything here?
  return;
};

export const VectorBasemapLayer = createLayerComponent<
  ReturnType<typeof Vector.vectorBasemapLayer>,
  VectorBasemapLayerProps
>(createVectorBasemapLayer, updateVectorBasemapLayer);
