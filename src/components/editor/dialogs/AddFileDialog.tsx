import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface AddFileDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (filename: string) => void;
    defaultFilename?: string;
}

const AddFileDialog = ({ isOpen, onOpenChange, onSubmit, defaultFilename }: AddFileDialogProps) => {
    const [filename, setFilename] = useState("");
    const [error, setError] = useState<string>("");

    useEffect(() => {
        if (isOpen) {
            setFilename(defaultFilename ?? "");
            setError("");
        }
    }, [isOpen, defaultFilename]);

    const validateFilename = (name: string): string | null => {
        if (!name.trim()) {
            return "Filename is required";
        }

        // Check for invalid characters
        const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
        if (invalidChars.test(name)) {
            return "Filename contains invalid characters";
        }

        // Check length (common filesystem limits)
        if (name.length > 255) {
            return "Filename is too long";
        }

        return null;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validateFilename(filename);
        if (validationError) {
            setError(validationError);
            return;
        }

        onSubmit(filename.endsWith(".md") ? filename : `${filename}.md`);
        setFilename("");
        setError("");
        onOpenChange(false);
    };

    const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newFilename = e.target.value;
        setFilename(newFilename);
        const validationError = validateFilename(newFilename);
        setError(validationError || "");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add new file</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            placeholder="Enter file name..."
                            value={filename}
                            onChange={handleFilenameChange}
                            autoFocus
                            aria-invalid={!!error}
                            aria-describedby={error ? "filename-error" : undefined}
                        />
                        {error && (
                            <p className="text-sm text-red-500 mt-2" id="filename-error" role="alert">
                                {error}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={!filename.trim() || !!error}>
                            Add
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AddFileDialog;