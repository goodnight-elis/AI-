import { memo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

/** 递归提取 React 节点中的纯文本（rehype-highlight 会把 children 变成元素数组） */
function extractText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractText((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

function CopyButton({ text, className }: { text: string; className: string }) {
  return (
    <button
      className={className}
      onClick={() => void navigator.clipboard.writeText(text)}
      title="复制代码"
    >
      复制
    </button>
  );
}

interface Props {
  content: string;
  /** 流式中：禁用耗时的语法高亮插件以外无需特殊处理，react-markdown 本身可增量渲染 */
  streaming?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: Props) {
  return (
    <div className="md-body text-[15px]">
      <ReactMarkdown
        rehypePlugins={[rehypeHighlight]}
        components={{
          // 围栏代码块由 code 组件接管布局，pre 直接透传避免双层包裹
          pre: ({ children }) => <>{children}</>,
          code({ className, children, ...rest }) {
            const match = /language-[\w-+]+/.exec(className ?? '');
            if (!match) {
              // 行内代码
              return (
                <code
                  className="rounded bg-gray-200 px-1 py-0.5 text-[0.9em] dark:bg-gray-700"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            const lang = match[0].slice(9);
            const raw = extractText(children).replace(/\n$/, '');
            return (
              <div className="my-2 overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700">
                <div className="flex items-center justify-between bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <span>{lang}</span>
                  <CopyButton
                    text={raw}
                    className="rounded px-2 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
                  />
                </div>
                <pre className="overflow-x-auto !m-0 !rounded-none !border-0">
                  <code className={className}>{raw}</code>
                </pre>
              </div>
            );
          },
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 underline dark:text-blue-400">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
