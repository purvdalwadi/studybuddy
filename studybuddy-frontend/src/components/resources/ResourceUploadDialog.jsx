import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const resourceSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  file: z.any().refine(f => f && f.length === 1, "File is required"),
  category: z.enum(["notes", "assignment", "presentation", "book", "paper", "other"]),
  tags: z.array(z.string()).max(8).optional(),
});

export default function ResourceUploadDialog({ onUpload }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    resolver: zodResolver(resourceSchema),
    defaultValues: {
      title: "",
      description: "",
      file: undefined,
      category: "notes",
      tags: [],
    }
  });
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const onSubmit = (data) => {
    onUpload({ ...data, tags });
    reset();
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">+ Upload Resource</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><span className="text-xl font-bold mb-4">Upload Resource</span></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <Input label="Title" {...register("title")} error={errors.title?.message} required />
          <Input label="Description" {...register("description")} error={errors.description?.message} />
          <input type="file" {...register("file")} required />
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select {...register("category")} className="w-full border rounded p-2">
              <option value="notes">Notes</option>
              <option value="assignment">Assignment</option>
              <option value="presentation">Presentation</option>
              <option value="book">Book</option>
              <option value="paper">Paper</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <div className="flex gap-2 flex-wrap mb-1">
              {tags.map((tag, idx) => (
                <span key={tag} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs flex items-center gap-1">
                  {tag}
                  <button type="button" className="ml-1 text-red-500" onClick={() => {
                    setTags(tags.filter((t, i) => i !== idx));
                  }}>×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add tag"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                    e.preventDefault();
                    if (!tags.includes(tagInput.trim()) && tags.length < 8) {
                      setTags([...tags, tagInput.trim()]);
                      setTagInput("");
                    }
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => {
                if (tagInput.trim() && !tags.includes(tagInput.trim()) && tags.length < 8) {
                  setTags([...tags, tagInput.trim()]);
                  setTagInput("");
                }
              }}>Add</Button>
            </div>
            <input type="hidden" {...register("tags")} value={tags.join(",")} />
          </div>
          <DialogFooter>
            <Button type="submit" variant="primary">Upload</Button>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
