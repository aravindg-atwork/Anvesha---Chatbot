import { ShaderBackground } from '@/components/ui/dark-mono';

export default function ShaderBackgroundDemo() {
  return <div className="relative h-screen w-full overflow-hidden" style={{ background: '#172a4f' }}>
    <ShaderBackground className="h-full w-full" />
  </div>;
}
