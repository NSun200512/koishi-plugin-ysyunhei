import type { HtmlTag } from './tagestype';

interface Attrs {
  style?: {
    [key: string]: string | number;
  },
  src?: string,
  href?: string,
}

function camelToKebab(str: string | number): string | number {
  if(typeof str === 'number') return str;
  return str.split(/(?=[A-Z])/).join('-').toLowerCase();
}

export default function xh(tag: HtmlTag, attrs: Attrs, ...children: (string | undefined)[]): string{
  let attrsString: string = '';
  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'style') {
        attrsString += `style="${Object.entries(value).map(([k, v]) => `${camelToKebab(k)}: ${camelToKebab((v as string | number))}`).join('; ')};" `;
      } else {
        attrsString += `${key}="${value}" `;
      }
    })
  }
  return `<${tag} ${attrsString}>${children.filter(child => child !== undefined).join('')}</${tag}>`;
}
