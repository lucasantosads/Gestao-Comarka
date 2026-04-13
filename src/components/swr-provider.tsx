"use client";

import { SWRConfig } from "swr";

export function SWRProvider({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig
            value={{
                revalidateOnFocus: false,
                keepPreviousData: true,
                dedupingInterval: 10000,
            }}
        >
            {children}
        </SWRConfig>
    );
}
