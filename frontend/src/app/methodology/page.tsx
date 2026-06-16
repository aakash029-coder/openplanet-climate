'use client';

import MethodologyModule from '@/components/MethodologyModule';
import { ClimateDataProvider } from '@/context/ClimateDataContext';

export default function MethodologyPage() {
  return (
    <ClimateDataProvider>
      <div className="w-full">
        <MethodologyModule />
      </div>
    </ClimateDataProvider>
  );
}
