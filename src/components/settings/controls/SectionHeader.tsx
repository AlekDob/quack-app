interface SectionHeaderProps {
  title: string;
  description?: string;
}

export default function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <h3 className="section-header-title">{title}</h3>
      {description && <p className="section-header-description">{description}</p>}
    </div>
  );
}
