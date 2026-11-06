import SettingsPage from '@/components/pages/settings.page';
import { use } from 'react';

export default function SettingsTeleGenieSkillDetailPage({
  params,
}: {
  params: Promise<{ skillId: string }>;
}) {
  const { skillId } = use(params);
  return (
    <SettingsPage
      section="telegenie"
      subSection="skill-detail"
      skillId={decodeURIComponent(skillId)}
    />
  );
}

