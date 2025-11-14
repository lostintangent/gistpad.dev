import {
    embededdedFileHandlersAtom,
    hasUnsavedChangesAtom,
    selectedGistAtom,
    selectedGistFileAtom,
} from "@/atoms";
import { fetchGistContent, GistFile } from "@/lib/github";
import * as Portal from "@radix-ui/react-portal";
import { useAtomValue, useSetAtom } from "jotai";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
    createTLStore,
    DefaultMainMenu,
    DefaultMainMenuContent,
    getSnapshot,
    loadSnapshot,
    Tldraw,
    TldrawUiMenuGroup,
    TldrawUiMenuItem,
    TLStore,
    TLStoreWithStatus
} from "tldraw";
import "tldraw/tldraw.css";
import { Button } from "../ui/button";
import { Collapsible, CollapsibleContent } from "../ui/collapsible";

const CustomMenu = ({
    onCollapse,
    onExpand,
    isFullscreen,
}: {
    onCollapse: () => void;
    onExpand: () => void;
    isFullscreen: boolean;
}) => {
    return (
        <DefaultMainMenu>
            <TldrawUiMenuGroup id="custom">
                <TldrawUiMenuItem
                    id="collapse"
                    label="Collapse whiteboard"
                    icon="minimize"
                    readonlyOk
                    onSelect={onCollapse}
                />
                <TldrawUiMenuItem
                    id="expand"
                    label={isFullscreen ? "Exit fullscreen" : "Expand fullscreen"}
                    icon={isFullscreen ? "minimize" : "maximize"}
                    readonlyOk
                    onSelect={onExpand}
                />
            </TldrawUiMenuGroup>
            <DefaultMainMenuContent />
        </DefaultMainMenu>
    );
};

const FullscreenTldraw = ({
    store,
    onClose,
}: {
    store: TLStoreWithStatus;
    onClose: () => void;
}) => {
    return (
        <Portal.Root>
            <div className="fixed inset-0 z-50 bg-background">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-4 z-50"
                    onClick={onClose}
                >
                    <X className="h-4 w-4" />
                </Button>
                <Tldraw
                    store={store}
                    inferDarkMode
                    options={{ maxPages: 1 }}
                    components={{
                        MainMenu: () => (
                            <CustomMenu
                                onCollapse={() => { }}
                                onExpand={onClose}
                                isFullscreen={true}
                            />
                        ),
                    }}
                />
            </div>
        </Portal.Root>
    );
};

export function TLDraw({ isReadonly = false }: { isReadonly?: boolean }) {
    const [store, setStore] = useState<TLStoreWithStatus>({
        status: "loading",
    });
    const [isExpanded, setIsExpanded] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const selectedGist = useAtomValue(selectedGistAtom);
    const selectedGistFile = useAtomValue(selectedGistFileAtom);

    const setHasUnsavedChanges = useSetAtom(hasUnsavedChangesAtom);
    const setEmbededdedFileHandlers = useSetAtom(embededdedFileHandlersAtom);

    const createEmbeddedFileHandler = (store: TLStore) => {
        return (): GistFile => {
            const snapshot = getSnapshot(store);
            const snapshotContent = JSON.stringify(snapshot);

            setEmbededdedFileHandlers([]);

            return {
                filename: `${selectedGistFile}.tldraw`,
                content: snapshotContent,
            };
        };
    };

    const initializeStore = (snapshotContent?: string) => {
        const newStore = createTLStore();
        if (snapshotContent) {
            const snapshot = JSON.parse(snapshotContent);
            loadSnapshot(newStore, snapshot);
        }

        setStore({ store: newStore, status: "synced-local" });
        newStore.listen(
            () => {
                setEmbededdedFileHandlers([createEmbeddedFileHandler(newStore)]);
                setHasUnsavedChanges(true);
            },
            { scope: "document", source: "user" }
        );
    };

    useEffect(() => {
        if (!selectedGist) return;

        setStore({ status: "loading" });

        const tldrawFileName = `${selectedGistFile}.tldraw`;
        if (!selectedGist.files[tldrawFileName]) {
            initializeStore();
            return;
        }

        const content = selectedGist.files[tldrawFileName].content;
        if (!content) {
            fetchGistContent(selectedGist.id, tldrawFileName).then(initializeStore);
        } else {
            initializeStore(content);
        }

        return () => setEmbededdedFileHandlers([]);
    }, [selectedGist, selectedGistFile]);

    if (!isExpanded) {
        return (
            <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsExpanded(true)}
            >
                <ChevronDown className="w-4 h-4 mr-2" />
                Expand whiteboard
            </Button>
        );
    }

    return (
        <>
            {isFullscreen ? (
                <FullscreenTldraw
                    store={store}
                    onClose={() => setIsFullscreen(false)}
                />
            ) : (
                <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                    <CollapsibleContent>
                        <div
                            style={{
                                aspectRatio: "16/9",
                            }}
                        >
                            <Tldraw
                                store={store}
                                inferDarkMode
                                options={{ maxPages: 1 }}
                                onMount={(editor) => {
                                    if (isReadonly) {
                                        editor.updateInstanceState({ isReadonly: true })
                                    }
                                }}
                                components={{
                                    MainMenu: () => (
                                        <CustomMenu
                                            onCollapse={() => setIsExpanded(false)}
                                            onExpand={() => setIsFullscreen(true)}
                                            isFullscreen={false}
                                        />
                                    ),
                                }}
                            />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </>
    );
}
