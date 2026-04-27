declare module "d3-geo" {
  interface GeoProjection {
    scale(): number;
    scale(scale: number): this;
    center(): [number, number];
    center(center: [number, number]): this;
    translate(): [number, number];
    translate(translate: [number, number]): this;
    fitSize(size: [number, number], object: object): this;
    fitExtent(extent: [[number, number], [number, number]], object: object): this;
    invert(point: [number, number]): [number, number] | null;
    (point: [number, number]): [number, number] | null;
  }

  export function geoMercator(): GeoProjection;
  export function geoContains(object: object, point: [number, number]): boolean;
}
