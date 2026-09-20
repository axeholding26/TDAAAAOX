// Rendu Markdown léger + extraction média pour les réponses AXIA, utilisé
// par l'écran plein écran (/dashboard).
export function renderMarkdown(raw: string): string {
  let s = raw
    // Fenced code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="axia-pre"><code class="axia-code">${code.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim()}</code></pre>`)
    // Inline code
    .replace(/`([^`\n]+)`/g, '<code class="axia-inline-code">$1</code>')
    // Bold + italic
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    // Headings
    .replace(/^### (.+)$/gm, '<p class="axia-h3">$1</p>')
    .replace(/^## (.+)$/gm, '<p class="axia-h2">$1</p>')
    .replace(/^# (.+)$/gm, '<p class="axia-h1">$1</p>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="axia-bq">$1</blockquote>')
    // Horizontal rule
    .replace(/^---+$/gm, '<hr class="axia-hr"/>')
    // Links
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="axia-link">$1</a>')
    // Lists
    .replace(/^[-•*] (.+)$/gm, '<li class="axia-li">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="axia-li axia-ol">$1</li>')
    // Paragraphs
    .replace(/\n\n+/g, '</p><p class="axia-p">')
    .replace(/\n/g, "<br/>");

  // Wrap list items
  s = s.replace(/(<li class="axia-li[^"]*">[\s\S]*?<\/li>)+/g, m => `<ul class="axia-ul">${m}</ul>`);
  return `<p class="axia-p">${s}</p>`;
}

export function parseContent(content: string): { text: string; images: string[]; videos: string[]; audios: string[] } {
  const images: string[] = [];
  const videos: string[] = [];
  const audios: string[] = [];
  const text = content
    .replace(/\[IMAGE:(https?:\/\/[^\]]+)\]/gi, (_, u) => { images.push(u); return ""; })
    .replace(/IMAGE:(https?:\/\/\S+)/gi, (_, u) => { images.push(u); return ""; })
    .replace(/\[VIDEO:(https?:\/\/[^\]]+)\]/gi, (_, u) => { videos.push(u); return ""; })
    .replace(/VIDEO:(https?:\/\/\S+)/gi, (_, u) => { videos.push(u); return ""; })
    .replace(/\[AUDIO:(https?:\/\/[^\]]+)\]/gi, (_, u) => { audios.push(u); return ""; })
    .replace(/AUDIO:(https?:\/\/\S+)/gi, (_, u) => { audios.push(u); return ""; })
    .trim();
  return { text, images, videos, audios };
}
