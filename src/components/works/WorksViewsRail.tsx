import { Fragment } from "react";
import type { WorkItem } from "../../works";
import {
  WORKS_SIDEBAR_VIEWS,
  countForView,
  type WorksSidebarView,
} from "../../worksViews";

type Props = {
  active: WorksSidebarView;
  items: WorkItem[];
  onSelect: (view: WorksSidebarView) => void;
};

export function WorksViewsRail({ active, items, onSelect }: Props) {
  return (
    <aside className="works-module-rail" aria-label="Views">
      <div className="works-rail-title">Views</div>
      {WORKS_SIDEBAR_VIEWS.map((v) => (
        <Fragment key={v.id}>
          {v.separatorBefore && (
            <div className="works-rail-sep" role="separator" />
          )}
          <button
            type="button"
            className={`works-module-item${active === v.id ? " active" : ""}`}
            onClick={() => onSelect(v.id)}
          >
            <span className="works-module-item-label">{v.label}</span>
            {v.id !== "modules" && (
              <span className="works-module-count">
                {countForView(items, v.id)}
              </span>
            )}
          </button>
        </Fragment>
      ))}
    </aside>
  );
}
