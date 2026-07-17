import { Icon } from "./Icon";
import {
  isFavoriteModel,
  modelKey,
  toggleFavoriteModel,
} from "../modelPrefs";
import type { ProviderModel } from "../providers/types";

interface Props {
  model: ProviderModel;
  selected: boolean;
  onPick: () => void;
  onFavoriteChange: () => void;
}

export function ModelPickerRow({
  model,
  selected,
  onPick,
  onFavoriteChange,
}: Props) {
  const qualified = modelKey(model.providerId, model.modelId);
  const favorited = isFavoriteModel(qualified);

  return (
    <div className="model-picker-row">
      <button type="button" className="model-picker-row-main" onClick={onPick}>
        <span className="model-picker-row-name">
          {model.displayName || model.modelId}
        </span>
        {model.isFree && (
          <span className="model-picker-row-tag tag-free">free</span>
        )}
        {model.supportsTools && (
          <span className="model-picker-row-tag">tools</span>
        )}
        {selected && (
          <Icon name="check" size={14} className="model-picker-row-check" />
        )}
      </button>
      <button
        type="button"
        className={`model-picker-star ${favorited ? "on" : ""}`}
        title={favorited ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavoriteModel(qualified);
          onFavoriteChange();
        }}
      >
        <Icon name={favorited ? "star-filled" : "star"} size={14} />
      </button>
    </div>
  );
}
