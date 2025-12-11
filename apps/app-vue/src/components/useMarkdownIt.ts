import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import mila from 'markdown-it-link-attributes'

// 初始化 Markdown 解析器
const md = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return `
                    <div class="code-block">
                        <div class="code-lang">${lang}</div>
                        <pre><code class="hljs ${lang}">${
                    hljs.highlight(str, { language: lang }).value
                }</code></pre>
                    </div>`;
            } catch (e) { /* 忽略错误 */ }
        }
        return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
});

md.use(mila, {
    attrs: {
        target: '_blank',
        rel: 'noopener'
    }
})
export { md }