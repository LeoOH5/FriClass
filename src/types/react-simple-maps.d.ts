declare module "react-simple-maps" {
  import { ReactNode, SVGProps } from "react";

  interface ProjectionConfig {
    scale?: number;
    center?: [number, number];
    rotate?: [number, number, number];
  }

  interface ComposableMapProps extends SVGProps<SVGSVGElement> {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    children?: ReactNode;
  }

  interface GeographiesProps {
    geography: string | object;
    children: (props: { geographies: GeoFeature[] }) => ReactNode;
  }

  interface GeoFeature {
    rsmKey: string;
    type: string;
    properties: Record<string, unknown>;
    geometry: object;
  }

  interface GeographyProps extends SVGProps<SVGPathElement> {
    geography: GeoFeature;
    style?: {
      default?: SVGProps<SVGPathElement>["style"] & Record<string, unknown>;
      hover?: SVGProps<SVGPathElement>["style"] & Record<string, unknown>;
      pressed?: SVGProps<SVGPathElement>["style"] & Record<string, unknown>;
    };
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
}
