import { toJQuery } from "./jquery";

export function injectActorDirectoryFooterButton(
  html: unknown,
  opts: {
    buttonId: string;
    label: string;
    iconClass?: string;
    extraClasses?: string;
    onClick: () => void;
  },
): void {
  const $html = toJQuery(html);
  if (!$html?.length) return;
  if ($html.find(`#${opts.buttonId}`).length) return;

  const footer = $html.find(".directory-footer");
  if (!footer.length) return;

  const icon = opts.iconClass ? `<i class="${opts.iconClass}"></i> ` : "";
  const extra = opts.extraClasses ? ` ${opts.extraClasses}` : "";

  const btn = $(
    `<button type="button" id="${opts.buttonId}" class="lgc-btn-footer${extra}">
      ${icon}${opts.label}
    </button>`,
  );

  btn.on("click", opts.onClick);
  footer.append(btn);
}
