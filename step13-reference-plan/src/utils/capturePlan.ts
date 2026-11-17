import html2canvas from 'html2canvas';

/** Resolve browser-native modern CSS colors for html2canvas's older color parser. */
export async function capturePlan(element: HTMLElement): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  return html2canvas(element, {
    scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff',
    onclone: clone => {
      const canvas = clone.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      const cache = new Map<string, string>();
      const convertColor = (color: string) => {
        if (cache.has(color)) return cache.get(color)!;
        context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        const result = `rgba(${r},${g},${b},${a / 255})`; cache.set(color, result); return result;
      };
      const convertValue = (value: string) => {
        const pattern = /(?:oklch|oklab|lch|lab|color-mix|color)\(/g;
        let result = '', offset = 0, match: RegExpExecArray | null;
        while ((match = pattern.exec(value))) {
          let end = pattern.lastIndex, depth = 1;
          while (end < value.length && depth) { if (value[end] === '(') depth++; if (value[end] === ')') depth--; end++; }
          result += value.slice(offset, match.index) + convertColor(value.slice(match.index, end));
          offset = end; pattern.lastIndex = end;
        }
        return result + value.slice(offset);
      };
      for (const node of Array.from(clone.querySelectorAll<HTMLElement | SVGElement>('*'))) {
        if (!node.style || ['STYLE', 'SCRIPT', 'LINK'].includes(node.tagName)) continue;
        const computed = clone.defaultView!.getComputedStyle(node);
        for (const property of Array.from(computed)) {
          const value = computed.getPropertyValue(property);
          if (/(?:oklch|oklab|lch|lab|color-mix|color)\(/.test(value)) node.style.setProperty(property, convertValue(value));
        }
        // SVG images are serialized separately by html2canvas; retain class-based styling.
        if (node.namespaceURI === 'http://www.w3.org/2000/svg') {
          for (const property of ['fill', 'stroke', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'paint-order']) {
            node.style.setProperty(property, convertValue(computed.getPropertyValue(property)));
          }
        }
      }
    },
  });
}
