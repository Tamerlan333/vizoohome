import { z } from "zod";
export const MAX_FILE_MB = 5;
export const step1 = z.object({ firstName: z.string().min(2,"Adı daxil edin."), lastName: z.string().min(2,"Soyadı daxil edin."), phone: z.string().regex(/^\+?[0-9\s-]{9,15}$/,"Düzgün əlaqə nömrəsi daxil edin.") });
export const step2 = z.object({ propertyType: z.enum(["apartment","house","commercial"],{message:"Əmlak tipini seçin."}), address: z.string().min(3,"Ərazi / ünvanı daxil edin."),
  price: z.coerce.number({message:"Qiyməti daxil edin."}).positive("Qiymət müsbət olmalıdır."), rooms: z.coerce.number().int().min(1,"Otaq sayını daxil edin."), area: z.coerce.number().positive("Sahəni daxil edin.") });
export const step3 = z.object({ notes: z.string().max(1000,"Maksimum 1000 simvol.").optional(), consent: z.literal(true,{message:"Razılığı təsdiq edin."}) });
export const submission = step1.merge(step2).merge(step3);
export type SubmissionInput = z.infer<typeof submission>;
